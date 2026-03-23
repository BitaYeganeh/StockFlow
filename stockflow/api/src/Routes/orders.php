<?php

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use StockFlow\Auth\SupabaseAuth;
use StockFlow\Middleware\AuthMiddleware;

// ============================================================
// GET /api/orders — List orders
// ============================================================
$app->get('/api/orders', function (Request $request, Response $response) {

    $auth = new SupabaseAuth();
    $auth->setToken($request->getAttribute('token'));

    $params = $request->getQueryParams();
    $statusFilter = $params['status'] ?? null;

    $query = [
        'select' => '*',
        'order' => 'created_at.desc'
    ];

    if ($statusFilter && in_array($statusFilter, ['draft', 'confirmed', 'fulfilled', 'cancelled'])) {
        $query['status'] = 'eq.' . $statusFilter;
    }

    $result = $auth->query('orders', $query);
    $orders = $result['data'] ?? [];

    $processed = array_map(function ($row) {

        $timestamp = strtotime($row['created_at']);
        $formattedDate = date('j M Y, H:i', $timestamp);
        $daysAgo = floor((time() - $timestamp) / 86400);

        if ($daysAgo === 0) $relative = 'Today';
        elseif ($daysAgo === 1) $relative = 'Yesterday';
        else $relative = $daysAgo . ' days ago';

        return [
            'id' => $row['id'],
            'customer_name' => $row['customer_name'] ?? '',
            'status' => $row['status'],
            'total_amount' => number_format((float)$row['total_amount'], 2),
            'notes' => $row['notes'] ?? '',
            'created_date' => $formattedDate,
            'created_ago' => $relative,
        ];
    }, $orders);

    $response->getBody()->write(json_encode(['data' => $processed]));
    return $response->withHeader('Content-Type', 'application/json');

})->add(new AuthMiddleware());


// ============================================================
// GET /api/orders/{id} — Single order with items
// ============================================================
$app->get('/api/orders/{id}', function (Request $request, Response $response, array $args) {

    $auth = new SupabaseAuth();
    $auth->setToken($request->getAttribute('token'));

    $id = $args['id'];

    $result = $auth->query('orders', ['id' => 'eq.' . $id]);
    $orders = $result['data'] ?? [];

    if (!$orders) {
        $response->getBody()->write(json_encode(['error' => 'Order not found']));
        return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
    }

    $order = $orders[0];

    // JOIN products
    $resultItems = $auth->query('order_items', [
        'select' => '*,products(name,sku)',
        'order_id' => 'eq.' . $id
    ]);

    $items = $resultItems['data'] ?? [];

    $itemsProcessed = array_map(function ($item) {
        return [
            'id' => $item['id'],
            'product_id' => $item['product_id'],
            'product_name' => $item['products']['name'] ?? '',
            'quantity' => (int)$item['quantity'],
            'unit_price' => number_format((float)$item['unit_price'], 2),
            'line_total' => number_format((float)$item['line_total'], 2),
        ];
    }, $items);

    $order['total_amount'] = number_format((float)$order['total_amount'], 2);
    $order['items'] = $itemsProcessed;

    $response->getBody()->write(json_encode($order));
    return $response->withHeader('Content-Type', 'application/json');

})->add(new AuthMiddleware());


// ============================================================
// POST /api/orders — Create order (secure totals)
// ============================================================
$app->post('/api/orders', function (Request $request, Response $response) {

    $auth = new SupabaseAuth();
    $auth->setToken($request->getAttribute('token'));

    $body = $request->getParsedBody();

    if (empty($body['customer_name']) || empty($body['items']) || !is_array($body['items'])) {
        $response->getBody()->write(json_encode(['error' => 'Missing customer_name or items']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    $orderData = [
        'customer_name' => trim($body['customer_name']),
        'status' => 'draft',
        'total_amount' => 0,
        'notes' => trim($body['notes'] ?? ''),
    ];

    // Step 1: create order
    $order = $auth->insert('orders', $orderData);

    if (!$order || !isset($order[0]['id'])) {
        $response->getBody()->write(json_encode(['error' => 'Failed to create order']));
        return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
    }

    $orderId = $order[0]['id'];
    $totalAmount = 0;
    $itemsProcessed = [];

    // Step 2: process items securely
    foreach ($body['items'] as $item) {

        if (!isset($item['product_id'], $item['quantity'])) continue;

        $productResult = $auth->query('products', [
            'id' => 'eq.' . $item['product_id']
        ]);

        $product = $productResult['data'][0] ?? null;
        if (!$product) continue;

        $price = (float)$product['price'];
        $quantity = (int)$item['quantity'];
        $lineTotal = $price * $quantity;

        $totalAmount += $lineTotal;

        $insertedItem = $auth->insert('order_items', [
            'order_id' => $orderId,
            'product_id' => $item['product_id'],
            'product_name' => $product['name'],
            'quantity' => $quantity,
            'unit_price' => $price,
            'line_total' => $lineTotal,
        ]);

        if ($insertedItem && isset($insertedItem[0])) {
            $itemsProcessed[] = $insertedItem[0];
        }
    }

    // Step 3: update total
    $auth->update('orders', 'id=eq.' . $orderId, [
        'total_amount' => $totalAmount
    ]);

    $response->getBody()->write(json_encode([
        'id' => $orderId,
        'total_amount' => number_format($totalAmount, 2),
        'items' => $itemsProcessed
    ]));

    return $response->withStatus(201)->withHeader('Content-Type', 'application/json');

})->add(new AuthMiddleware());


// ============================================================
// PUT /api/orders/{id}/status — State machine + stock update
// ============================================================
$app->put('/api/orders/{id}/status', function (Request $request, Response $response, array $args) {

    $auth = new SupabaseAuth();
    $auth->setToken($request->getAttribute('token'));

    $id = $args['id'];
    $body = $request->getParsedBody();
    $newStatus = $body['status'] ?? null;

    if (!$newStatus) {
        return $response->withStatus(400)->withBody(
            $response->getBody()->write(json_encode(['error' => 'Missing status']))
        );
    }

    $result = $auth->query('orders', ['id' => 'eq.' . $id]);
    $orders = $result['data'] ?? [];

    if (!$orders) {
        $response->getBody()->write(json_encode(['error' => 'Order not found']));
        return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
    }

    $currentStatus = $orders[0]['status'];

    $validTransitions = [
        'draft' => ['confirmed', 'cancelled'],
        'confirmed' => ['fulfilled', 'cancelled'],
        'fulfilled' => [],
        'cancelled' => [],
    ];

    if (!in_array($newStatus, $validTransitions[$currentStatus] ?? [])) {
        $response->getBody()->write(json_encode([
            'error' => "Cannot change status from $currentStatus to $newStatus"
        ]));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    // 🔥 If fulfilling → reduce stock
    if ($currentStatus === 'confirmed' && $newStatus === 'fulfilled') {

        $items = $auth->query('order_items', [
            'order_id' => 'eq.' . $id
        ])['data'] ?? [];

        foreach ($items as $item) {

            $product = $auth->query('products', [
                'id' => 'eq.' . $item['product_id']
            ])['data'][0] ?? null;

            if (!$product) continue;

            $newQty = (int)$product['stock_quantity'] - (int)$item['quantity'];

            $auth->update('products', 'id=eq.' . $item['product_id'], [
                'stock_quantity' => $newQty
            ]);
        }
    }

    $auth->update('orders', 'id=eq.' . $id, ['status' => $newStatus]);

    $response->getBody()->write(json_encode([
        'id' => $id,
        'status' => $newStatus
    ]));

    return $response->withHeader('Content-Type', 'application/json');

})->add(new AuthMiddleware());