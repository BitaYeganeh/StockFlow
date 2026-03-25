<?php

/**
 * AI Routes — Gemini Integration (Mock Mode)
 *
 * EXERCISE 8: Use the GeminiAI class to add AI-powered features
 *
 * NOTE: Mock responses are used because the Gemini API quota
 * has been exceeded. This allows the frontend to work and
 * demonstrates the correct backend logic. Once the quota is
 * restored or upgraded, you can uncomment the real $ai->ask() calls.
 */

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use StockFlow\Auth\SupabaseAuth;
use StockFlow\AI\GeminiAI;
use StockFlow\Middleware\AuthMiddleware;

// ============================================================
// POST /api/ai/describe — Generate a product description
// ============================================================

$app->post('/api/ai/describe', function (Request $request, Response $response) {

    $auth = new SupabaseAuth();
    $auth->setToken($request->getAttribute('token'));

    $body = $request->getParsedBody();
    $productId = $body['product_id'] ?? null;

    if (!$productId) {
        $response->getBody()->write(json_encode(['error' => 'Missing product_id']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    $products = $auth->query('products', [
        'id' => 'eq.' . $productId,
        'select' => '*,categories!category_id(name)'
    ]);

    if (!$products['data'] || count($products['data']) === 0) {
        $response->getBody()->write(json_encode(['error' => 'Product not found']));
        return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
    }

    $product = $products['data'][0]; // ✅ fix

    $category = $product['categories']['name'] ?? 'General';
    $price = number_format((float)$product['price'], 2);

    $prompt = "Write a short 2-3 sentence product description for {$product['name']}. "
        . "Category: {$category}. Price: {$price} EUR.";

    try {
        $ai = new GeminiAI();
        $description = $ai->ask($prompt);

        $response->getBody()->write(json_encode(['description' => $description]));
        return $response->withHeader('Content-Type', 'application/json');

    } catch (\Exception $e) {
        $response->getBody()->write(json_encode([
            'description' => "AI service unavailable.",
            'error' => $e->getMessage()
        ]));
        return $response->withStatus(503)->withHeader('Content-Type', 'application/json');
    }

})->add(new AuthMiddleware());

// ============================================================
// POST /api/ai/stock-advice — Get AI advice on stock levels
// ============================================================

$app->post('/api/ai/stock-advice', function (Request $request, Response $response) {

    $auth = new SupabaseAuth();
    $auth->setToken($request->getAttribute('token'));

    $productsResult = $auth->query('products', ['select' => '*']);
    $products = $productsResult['data'] ?? [];

    $lowStock = array_filter($products, fn($p) => $p['stock_quantity'] <= $p['reorder_threshold']);

    if (count($lowStock) === 0) {
        $response->getBody()->write(json_encode(['message' => 'No low stock products']));
        return $response->withHeader('Content-Type', 'application/json');
    }

    $lowStock = array_slice($lowStock, 0, 10);

    $prompt = "These products are low in stock. Suggest how much to reorder and explain why:\n";
    foreach ($lowStock as $p) {
        $prompt .= "- {$p['name']}: {$p['stock_quantity']} in stock, threshold: {$p['reorder_threshold']}\n";
    }

    try {
        $ai = new GeminiAI();
        $advice = $ai->ask($prompt);

        $response->getBody()->write(json_encode([
            'advice' => $advice,
            'products' => array_values($lowStock)
        ]));
        return $response->withHeader('Content-Type', 'application/json');

    } catch (\Exception $e) {
        $response->getBody()->write(json_encode([
            'advice' => "AI service unavailable.",
            'error' => $e->getMessage()
        ]));
        return $response->withStatus(503)->withHeader('Content-Type', 'application/json');
    }

})->add(new AuthMiddleware());

// ============================================================
// POST /api/ai/summarize-orders — Summarize recent orders
// ============================================================

$app->post('/api/ai/summarize-orders', function (Request $request, Response $response) {

    $auth = new SupabaseAuth();
    $auth->setToken($request->getAttribute('token'));

    $ordersResult = $auth->query('orders', ['select' => '*']);
    $orders = $ordersResult['data'] ?? [];

    $sevenDaysAgo = date('Y-m-d', strtotime('-7 days'));
    $recentOrders = array_filter($orders, fn($o) => substr($o['created_at'], 0, 10) >= $sevenDaysAgo);

    if (count($recentOrders) === 0) {
        $response->getBody()->write(json_encode(['message' => 'No recent orders']));
        return $response->withHeader('Content-Type', 'application/json');
    }

    $prompt = "Summarize these recent orders and identify trends (sales performance, common statuses, etc):\n";
    foreach ($recentOrders as $o) {
        $prompt .= "- Order {$o['id']}, Total: {$o['total_amount']}, Status: {$o['status']}\n";
    }

    try {
        $ai = new GeminiAI();
        $summary = $ai->ask($prompt);

        $response->getBody()->write(json_encode([
            'summary' => $summary,
            'orders' => array_values($recentOrders)
        ]));
        return $response->withHeader('Content-Type', 'application/json');

    } catch (\Exception $e) {
        $response->getBody()->write(json_encode([
            'summary' => "AI service unavailable.",
            'error' => $e->getMessage()
        ]));
        return $response->withStatus(503)->withHeader('Content-Type', 'application/json');
    }

})->add(new AuthMiddleware());