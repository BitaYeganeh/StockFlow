<?php

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use StockFlow\Auth\SupabaseAuth;
use StockFlow\Middleware\AuthMiddleware;

error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING);

// ============================================================
// GET /api/stock/movements
// ============================================================
$app->get('/api/stock/movements', function (Request $request, Response $response) {

    $auth = new SupabaseAuth();

    // 🔥 IMPORTANT: SupabaseAuth::query returns ['data'=>...]
    $result = $auth->query('stock_movements', [
        'select' => '*,products(name,sku)',
        'order' => 'created_at.desc'
    ]);

    $movements = $result['data'] ?? [];

    if (!is_array($movements)) {
        $movements = [];
    }

    $processed = array_map(function ($row) {

        $timestamp = isset($row['created_at']) ? strtotime($row['created_at']) : time();
        $formattedDate = date('j M Y, H:i', $timestamp);
        $daysAgo = floor((time() - $timestamp) / 86400);

        if ($daysAgo === 0) $relative = 'Today';
        elseif ($daysAgo === 1) $relative = 'Yesterday';
        else $relative = $daysAgo . ' days ago';

        return [
            'id' => $row['id'],
            'product_id' => $row['product_id'],
            'product_name' => $row['products']['name'] ?? 'Unknown',
            'sku' => $row['products']['sku'] ?? '',
            'quantity' => (int)$row['quantity'],
            'movement_type' => $row['movement_type'],
            'created_date' => $formattedDate,
            'created_ago' => $relative,
        ];

    }, $movements);

    $response->getBody()->write(json_encode($processed));
    return $response->withHeader('Content-Type', 'application/json');
});


// ============================================================
// POST /api/stock/movements
// ============================================================
$app->post('/api/stock/movements', function (Request $request, Response $response) {

    $auth = new SupabaseAuth();
    $auth->setToken($request->getAttribute('token'));

    $body = $request->getParsedBody();

    $productId = $body['product_id'] ?? null;
    $quantity = isset($body['quantity']) ? (int)$body['quantity'] : 0;
    $type = $body['movement_type'] ?? null;

    // =========================
    // VALIDATION
    // =========================
    if (!$productId || $quantity <= 0 || !in_array($type, ['in', 'out', 'adjustment'])) {
        $response->getBody()->write(json_encode(['error' => 'Invalid input']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    // =========================
    // 🔥 ALWAYS GET FRESH PRODUCT (FIX)
    // =========================
    $productResult = $auth->query('products', [
        'id' => 'eq.' . $productId,
        'select' => '*'
    ]);

    $products = $productResult['data'] ?? [];

    if (!is_array($products) || count($products) === 0) {
        $response->getBody()->write(json_encode(['error' => 'Product not found']));
        return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
    }

    $product = $products[0];

    // 🔥 FORCE INTEGER
    $currentQty = isset($product['stock_quantity']) ? (int)$product['stock_quantity'] : 0;

    // =========================
    // 🔥 SAFE STOCK LOGIC
    // =========================
    $newQty = $currentQty;

    if ($type === 'in') {
        $newQty = $currentQty + $quantity;
    }

    if ($type === 'out') {
        if ($quantity > $currentQty) {
            $response->getBody()->write(json_encode([
                'error' => 'Not enough stock',
                'current_stock' => $currentQty
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        $newQty = $currentQty - $quantity;
    }

    if ($type === 'adjustment') {
        $newQty = $quantity;
    }

    // =========================
    // INSERT MOVEMENT
    // =========================
    $auth->insert('stock_movements', [
        'product_id' => $productId,
        'quantity' => $quantity,
        'movement_type' => $type,
        'reason' => $body['reason'] ?? null,
        'notes' => $body['notes'] ?? null,
    ]);

    // =========================
    // 🔥 FORCE UPDATE STOCK
    // =========================
    $auth->update('products', 'id=eq.' . $productId, [
        'stock_quantity' => (int)$newQty
    ]);

    // =========================
    // 🔥 VERIFY AFTER UPDATE
    // =========================
    $checkResult = $auth->query('products', [
        'id' => 'eq.' . $productId,
        'select' => '*'
    ]);

    $updated = $checkResult['data'][0] ?? $product;

    $response->getBody()->write(json_encode([
        'product_id' => $productId,
        'product_name' => $updated['name'],
        'sku' => $updated['sku'],
        'old_quantity' => $currentQty,
        'new_quantity' => (int)$updated['stock_quantity'],
    ]));

    return $response->withHeader('Content-Type', 'application/json');

})->add(new AuthMiddleware());