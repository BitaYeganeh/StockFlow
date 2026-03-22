<?php

/**
 * Orders Routes
 *
 * EXERCISE 6: CRUD — Orders
 */

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use StockFlow\Auth\SupabaseAuth;
use StockFlow\Middleware\AuthMiddleware;

// ============================================================
// GET /api/orders — List orders (filter by status optional)
// ============================================================
$app->get('/api/orders', function (Request $request, Response $response) {

    $auth = new SupabaseAuth();
    $params = $request->getQueryParams();
    $statusFilter = $params['status'] ?? null;

    $query = [
        'order' => 'created_at.desc'
    ];

    // Only filter if explicitly provided
    if ($statusFilter) {
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

    $response->getBody()->write(json_encode($processed));
    return $response->withHeader('Content-Type', 'application/json');

})->add(new AuthMiddleware());

// ============================================================
// GET /api/orders/{id} — Fetch single order with items
// ============================================================
$app->get('/api/orders/{id}', function (Request $request, Response $response, array $args) {

    $id = $args['id'];
    $auth = new SupabaseAuth();

    $result = $auth->query('orders', ['id' => 'eq.' . $id]);
    $orders = $result['data'] ?? [];    if (!$orders || count($orders) === 0) {
        
    $response->getBody()->write(json_encode(['error' => 'Order not found']));
        return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
    }

    $order = $orders[0];

    // Fetch items
    $resultItems = $auth->query('order_items', ['order_id' => 'eq.' . $id]);
    $items = $resultItems['data'] ?? [];
    if (!$items || !is_array($items)) $items = [];

    // Format items
    $itemsProcessed = array_map(function ($item) {
        return [
            'id' => $item['id'],
            'product_id' => $item['product_id'],
            'product_name' => $item['product_name'] ?? '',
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
// POST /api/orders — Create a new order
// ============================================================
$app->post('/api/orders', function (Request $request, Response $response) {

    $auth = new SupabaseAuth();
    $auth->setToken($request->getAttribute('token'));
    $body = $request->getParsedBody();

    if (empty($body['customer_name']) || empty($body['items']) || !is_array($body['items'])) {
        $response->getBody()->write(json_encode(['error' => 'Missing customer_name or items array']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    $orderData = [
        'customer_name' => trim($body['customer_name']),
        'status' => 'draft', // keep draft
        'total_amount' => 0,
        'notes' => trim($body['notes'] ?? ''),
        'created_by' => $body['created_by'] ?? null,
    ];

    // Step 1: Insert order
    $order = $auth->insert('orders', $orderData);

    if (!$order || !isset($order[0]['id'])) {
        error_log('Supabase insert failed: ' . print_r($order, true));
        $response->getBody()->write(json_encode([
            'error' => 'Failed to create order',
            'details' => $order
        ]));
        return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
    }

    $order = $order[0];
    $orderId = $order['id'];
    $totalAmount = 0;
    $itemsProcessed = [];

    // Step 2: Insert order items
    foreach ($body['items'] as $item) {
        if (!isset($item['product_id'], $item['quantity'], $item['unit_price'])) continue;

        $lineTotal = (float)$item['quantity'] * (float)$item['unit_price'];
        $totalAmount += $lineTotal;

        $insertedItem = $auth->insert('order_items', [
            'order_id' => $orderId,
            'product_id' => $item['product_id'],
            'product_name' => $item['product_name'] ?? '',
            'quantity' => (int)$item['quantity'],
            'unit_price' => (float)$item['unit_price'],
            'line_total' => $lineTotal,
        ]);

        if ($insertedItem && isset($insertedItem[0])) {
            $itemsProcessed[] = $insertedItem[0];
        }
    }

    // Step 3: Update order total_amount
    $auth->update('orders', 'id=eq.' . $orderId, ['total_amount' => $totalAmount]);

    $order['total_amount'] = number_format($totalAmount, 2);
    $order['items'] = $itemsProcessed;

    $response->getBody()->write(json_encode($order));
    return $response->withStatus(201)->withHeader('Content-Type', 'application/json');

})->add(new AuthMiddleware());

// ============================================================
// PUT /api/orders/{id}/status — Update order status
// ============================================================
$app->put('/api/orders/{id}/status', function (Request $request, Response $response, array $args) {

    $id = $args['id'];
    $auth = new SupabaseAuth();
    $auth->setToken($request->getAttribute('token'));
    $body = $request->getParsedBody();
    $newStatus = $body['status'] ?? null;

    if (!$newStatus) {
        $response->getBody()->write(json_encode(['error' => 'Missing status']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    $result = $auth->query('orders', ['id' => 'eq.' . $id]);
    $orders = $result['data'] ?? [];
    if (count($orders) === 0) {
        $response->getBody()->write(json_encode(['error' => 'Order not found']));
        return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
    }

    $currentStatus = $orders[0]['status'];

    $validTransitions = [
        'draft' => ['confirmed', 'cancelled'],
        'confirmed' => ['fulfilled', 'cancelled'],
    ];

    if (!isset($validTransitions[$currentStatus]) || !in_array($newStatus, $validTransitions[$currentStatus])) {
        $response->getBody()->write(json_encode([
            'error' => "Cannot change status from $currentStatus to $newStatus"
        ]));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    $auth->update('orders', 'id=eq.' . $id, ['status' => $newStatus]);
    $response->getBody()->write(json_encode(['id' => $id, 'status' => $newStatus]));

    return $response->withHeader('Content-Type', 'application/json');

})->add(new AuthMiddleware());