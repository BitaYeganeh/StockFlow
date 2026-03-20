<?php

/**
 * AI Routes — Gemini Integration
 *
 * EXERCISE 8: Use the GeminiAI class to add AI-powered features
 *
 * The GeminiAI class is already built (src/AI/GeminiAI.php).
 * Your job is to build the routes that USE it with real data.
 */

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use StockFlow\Auth\SupabaseAuth;
use StockFlow\AI\GeminiAI;
use StockFlow\Middleware\AuthMiddleware;

// ============================================================
// POST /api/ai/describe — Generate a product description
// ============================================================
// EXERCISE 6 (Step 1): Students build this route
//
// Given a product name and basic details, ask Gemini to write
// a short marketing description.
//
// The frontend sends:
//   { product_id: "uuid" }
//
// Your route should:
//   1. Fetch the product from Supabase (to get name, category, price)
//   2. Build a prompt like:
//      "Write a short product description (2-3 sentences) for: {name}.
//       Category: {category}. Price: {price} EUR."
//   3. Send the prompt to Gemini using $ai->ask($prompt)
//   4. Return the generated description
//
// Hints:
//   - Create the AI instance: $ai = new GeminiAI();
//   - Call it: $description = $ai->ask($prompt);
//   - Wrap in try/catch — AI calls can fail (rate limits, network issues)
// ============================================================

// STUB: Returns "not implemented" until students implement Exercise 8 (Step 1).
// Replace the body of this route with your own logic.
$app->post('/api/ai/describe', function (Request $request, Response $response) {

    // $body = $request->getParsedBody();
    // $productId = $body['product_id'] ?? null;

    $auth = new SupabaseAuth();
    $auth->setToken($request->getAttribute('token'));

    $body = $request->getParsedBody();
    $productId = $body['product_id'] ?? null;

    // TODO: Validate product_id
    if (!$productId) {
        $response->getBody()->write(json_encode(['error' => 'Missing product_id']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    // TODO: Fetch the product from Supabase
    $products = $auth->query('products', [
        'id' => 'eq.' . $productId,
        'select' => '*,categories!category_id(name)'
    ]);

    if (!$products || count($products) === 0) {
        $response->getBody()->write(json_encode(['error' => 'Product not found']));
        return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
    }

    $product = $products[0];

    // TODO: Build a prompt using the product data
    $prompt = "Write a short 2-3 sentence product description for:
Name: {$product['name']}
Category: " . ($product['categories']['name'] ?? 'General') . "
Price: {$product['price']} EUR";

    // TODO: Send to Gemini and return the result
    try {
        $ai = new GeminiAI();
        $description = $ai->ask($prompt);

        $response->getBody()->write(json_encode([
            'description' => $description
        ]));

        return $response->withHeader('Content-Type', 'application/json');

    } catch (\Exception $e) {
        $response->getBody()->write(json_encode([
            'error' => $e->getMessage()
        ]));
        return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
    }

})->add(new AuthMiddleware());


// ============================================================
// POST /api/ai/stock-advice — Get AI advice on stock levels
// ============================================================
// EXERCISE 6 (Step 2): Students build this route
//
// Fetch all products with low stock and ask Gemini for advice.
//
// Your route should:
//   1. Fetch products where stock_quantity <= reorder_threshold
//   2. Build a prompt with the low-stock products list
//   3. Ask Gemini for reorder recommendations
//   4. Return the AI advice plus the product data
// ============================================================

$app->post('/api/ai/stock-advice', function (Request $request, Response $response) {

    // TODO: Fetch all products
    $auth = new SupabaseAuth();
    $auth->setToken($request->getAttribute('token'));

    $products = $auth->query('products', ['select' => '*']);
    if (!$products) $products = [];

    // TODO: Filter to only those with stock_quantity <= reorder_threshold
    $lowStock = array_filter($products, function ($p) {
        return $p['stock_quantity'] <= $p['reorder_threshold'];
    });

    if (count($lowStock) === 0) {
        $response->getBody()->write(json_encode([
            'message' => 'No low stock products'
        ]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    // TODO: Build prompt with the low-stock items
    $prompt = "These products are running low on stock. Suggest reorder quantities:\n";

    foreach ($lowStock as $p) {
        $prompt .= "- {$p['name']}: {$p['stock_quantity']} in stock, threshold: {$p['reorder_threshold']}\n";
    }

    // TODO: Ask Gemini for advice
    try {
        $ai = new GeminiAI();
        $advice = $ai->ask($prompt);

        // TODO: Return the advice and product data
        $response->getBody()->write(json_encode([
            'advice' => $advice,
            'products' => array_values($lowStock)
        ]));

        return $response->withHeader('Content-Type', 'application/json');

    } catch (\Exception $e) {
        $response->getBody()->write(json_encode([
            'error' => $e->getMessage()
        ]));
        return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
    }

})->add(new AuthMiddleware());


// ============================================================
// POST /api/ai/summarize-orders — Summarize recent orders
// ============================================================
// EXERCISE 6 (Step 3 — Stretch)
// ============================================================

$app->post('/api/ai/summarize-orders', function (Request $request, Response $response) {

    $auth = new SupabaseAuth();
    $auth->setToken($request->getAttribute('token'));

    // TODO: Fetch orders
    $orders = $auth->query('orders', ['select' => '*']);
    if (!$orders) $orders = [];

    // TODO: Filter last 7 days
    $sevenDaysAgo = date('Y-m-d', strtotime('-7 days'));

    $recentOrders = array_filter($orders, function ($o) use ($sevenDaysAgo) {
        return substr($o['created_at'], 0, 10) >= $sevenDaysAgo;
    });

    if (count($recentOrders) === 0) {
        $response->getBody()->write(json_encode([
            'message' => 'No recent orders'
        ]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    // TODO: Build prompt
    $prompt = "Summarize these recent orders and identify trends:\n";

    foreach ($recentOrders as $o) {
        $prompt .= "- Order {$o['id']}, Total: {$o['total_amount']}, Status: {$o['status']}\n";
    }

    // TODO: Ask Gemini
    try {
        $ai = new GeminiAI();
        $summary = $ai->ask($prompt);

        // TODO: Return summary
        $response->getBody()->write(json_encode([
            'summary' => $summary,
            'orders' => array_values($recentOrders)
        ]));

        return $response->withHeader('Content-Type', 'application/json');

    } catch (\Exception $e) {
        $response->getBody()->write(json_encode([
            'error' => $e->getMessage()
        ]));
        return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
    }

})->add(new AuthMiddleware());