<?php

/**
 * Products Routes
 *
 * EXERCISES IN THIS FILE:
 * - Exercise 1: Pre-process product data (stock status, formatted prices)
 * - Exercise 2: Add search and filtering via query parameters
 * - Exercise 4: Full CRUD operations (create, update, delete)
 * - Exercise 5: Image upload to Supabase Storage
 */

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use StockFlow\Auth\SupabaseAuth;
use StockFlow\Middleware\AuthMiddleware;

// ============================================================
// GET /api/products — List products (public)
// ============================================================
$app->get('/api/products', function (Request $request, Response $response) {

    $auth = new SupabaseAuth();

    // --- Query parameters for search/filter/pagination ---
    $params = $request->getQueryParams();
    $search = $params['search'] ?? null;
    $category = $params['category'] ?? null;
    $status = $params['status'] ?? null;

    $requestedSort = $params['sort'] ?? 'name';
    $allowedSorts = ['name', 'price', 'stock_quantity'];
    $sort = in_array($requestedSort, $allowedSorts, true) ? $requestedSort : 'name';

    $order = strtolower($params['order'] ?? 'asc') === 'desc' ? 'desc' : 'asc';
    $page = max(1, (int)($params['page'] ?? 1));
    $limit = max(1, min(100, (int)($params['limit'] ?? 10)));

    $queryParams = [
        'select' => '*,categories!inner(name)',
        'order' => $sort . '.' . $order,
        'limit' => $limit,
        'offset' => ($page - 1) * $limit,
    ];

    if ($search) $queryParams['name'] = 'ilike.*' . $search . '*';
    if ($status) $queryParams['status'] = 'eq.' . $status;
    if ($category) $queryParams['categories.name'] = 'eq.' . $category;

    $result = $auth->query('products', $queryParams, true);
    $products = $result['data'] ?? [];
    $total = $result['total'] ?? 0;

    // --- Pre-process stock and prices ---
    $processed = array_map(function ($product) {
        $quantity = (int)($product['stock_quantity'] ?? 0);
        $threshold = (int)($product['reorder_threshold'] ?? 0);

        if ($quantity === 0) $stockStatus = 'out_of_stock';
        elseif ($quantity <= $threshold) $stockStatus = 'low_stock';
        else $stockStatus = 'in_stock';

        return [
            'id' => $product['id'],
            'name' => $product['name'],
            'sku' => $product['sku'],
            'price' => number_format((float)$product['price'], 2),
            'description' => $product['description'] ?? '',
            'stock_quantity' => $quantity,
            'category_name' => $product['categories']['name'] ?? 'Uncategorized',
            'category_id' => $product['category_id'] ?? null,
            'image_url' => $product['image_url'] ?? null,
            'status' => $product['status'],
            'stock_status' => $stockStatus,
        ];
    }, $products);

    $response->getBody()->write(json_encode([
        'data' => $processed,
        'page' => $page,
        'limit' => $limit,
        'total' => $total
    ]));

    return $response->withHeader('Content-Type', 'application/json');
});

// ============================================================
// GET /api/products/{id} — Fetch a single product
// ============================================================
$app->get('/api/products/{id}', function (Request $request, Response $response, array $args) {

    $id = $args['id'];
    $auth = new SupabaseAuth();

    $products = $auth->query('products', [
        'id' => 'eq.' . $id,
        'select' => '*,categories!category_id(name)'
    ]);

    if (!$products || count($products) === 0) {
        $response->getBody()->write(json_encode(['error' => 'Product not found']));
        return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
    }

    $product = $products[0];

    // --- Determine stock status ---
    $quantity = (int)($product['stock_quantity'] ?? 0);
    $threshold = (int)($product['reorder_threshold'] ?? 0);

    if ($quantity === 0) $stockStatus = 'out_of_stock';
    elseif ($quantity <= $threshold) $stockStatus = 'low_stock';
    else $stockStatus = 'in_stock';

    $processed = [
        'id' => $product['id'],
        'name' => $product['name'],
        'sku' => $product['sku'],
        'price' => number_format((float)$product['price'], 2),
        'description' => $product['description'] ?? '',
        'stock_quantity' => $quantity,
        'category_name' => $product['categories']['name'] ?? 'Uncategorized',
        'category_id' => $product['category_id'] ?? null,
        'image_url' => $product['image_url'] ?? null,
        'status' => $product['status'],
        'stock_status' => $stockStatus,
    ];

    $response->getBody()->write(json_encode($processed));
    return $response->withHeader('Content-Type', 'application/json');
});