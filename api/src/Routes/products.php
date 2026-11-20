<?php

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use StockFlow\Auth\SupabaseAuth;
use StockFlow\Middleware\AuthMiddleware;

// ============================================================
// GET /api/products — List products
// ============================================================
$app->get('/api/products', function (Request $request, Response $response) {

    $auth = new SupabaseAuth();

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
        'select' => '*,categories(name)',
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
            'category_name' => $product['categories'][0]['name'] ?? 'Uncategorized',            'category_id' => $product['category_id'] ?? null,
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
// GET /api/products/{id}
// ============================================================
$app->get('/api/products/{id}', function (Request $request, Response $response, array $args) {

    $auth = new SupabaseAuth();
    $id = $args['id'];

    $result = $auth->query('products', [
        'id' => 'eq.' . $id,
        'select' => '*,categories!category_id(name)'
    ]);
    $products = $result['data'] ?? [];

    if (count($products) === 0) {
        $response->getBody()->write(json_encode(['error' => 'Product not found']));
        return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
    }

    $product = $products[0];

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
        'category_name' => $product['categories'][0]['name'] ?? 'Uncategorized',        'category_id' => $product['category_id'] ?? null,
        'image_url' => $product['image_url'] ?? null,
        'status' => $product['status'],
        'stock_status' => $stockStatus,
    ];

    $response->getBody()->write(json_encode($processed));
    return $response->withHeader('Content-Type', 'application/json');
});


// ============================================================
// POST /api/products (CREATE)
// ============================================================
$app->post('/api/products', function (Request $request, Response $response) {

    $auth = new SupabaseAuth();
    $auth->setToken($request->getAttribute('token'));

    $body = $request->getParsedBody();

    $name = trim($body['name'] ?? '');
    $sku = trim($body['sku'] ?? '');
    $price = isset($body['price']) ? (float)$body['price'] : null;

    if (!$name || !$sku || $price === null) {
        $response->getBody()->write(json_encode(['error' => 'Missing required fields']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    // 🔥 FIX: prevent empty UUID
    $categoryId = $body['category_id'] ?? null;
    if ($categoryId === '') {
        $categoryId = null;
    }

    $data = [
        'name' => $name,
        'sku' => $sku,
        'price' => $price,
        'description' => $body['description'] ?? null,
        'category_id' => $categoryId, // ✅ fixed
        'image_url' => $body['image_url'] ?? null,
        'stock_quantity' => (int)($body['stock_quantity'] ?? 0),
        'status' => 'active'
    ];

    try {
        $inserted = $auth->insert('products', $data);

        $response->getBody()->write(json_encode($inserted));
        return $response->withStatus(201)->withHeader('Content-Type', 'application/json');

    } catch (Exception $e) {
        error_log($e->getMessage());

        $response->getBody()->write(json_encode([
            'error' => 'Insert failed',
            'details' => $e->getMessage()
        ]));

        return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
    }

})->add(new AuthMiddleware());

// ============================================================
// PUT /api/products/{id} (UPDATE)
// ============================================================
$app->put('/api/products/{id}', function (Request $request, Response $response, array $args) {

    $auth = new SupabaseAuth();
    $auth->setToken($request->getAttribute('token'));

    $id = $args['id'];
    $body = $request->getParsedBody();

    $data = [];

    if (isset($body['name'])) $data['name'] = trim($body['name']);
    if (isset($body['sku'])) $data['sku'] = trim($body['sku']);
    if (isset($body['price'])) $data['price'] = (float)$body['price'];
    if (isset($body['description'])) $data['description'] = $body['description'];
    if (isset($body['category_id'])) {
    $data['category_id'] = $body['category_id'] === '' ? null : $body['category_id'];
    }
    if (isset($body['image_url'])) $data['image_url'] = $body['image_url'];
    if (isset($body['status'])) $data['status'] = $body['status'];

    if (empty($data)) {
        $response->getBody()->write(json_encode(['error' => 'No fields to update']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    $updated = $auth->update('products', 'id=eq.' . $id, $data);

    $response->getBody()->write(json_encode($updated));
    return $response->withHeader('Content-Type', 'application/json');

})->add(new AuthMiddleware());


// ============================================================
// DELETE /api/products/{id} (SOFT DELETE)
// ============================================================
$app->delete('/api/products/{id}', function (Request $request, Response $response, array $args) {

    $auth = new SupabaseAuth();
    $auth->setToken($request->getAttribute('token'));

    $id = $args['id'];

    $auth->update('products', 'id=eq.' . $id, [
        'status' => 'archived'
    ]);

    $response->getBody()->write(json_encode([
        'message' => 'Product archived successfully'
    ]));

    return $response->withHeader('Content-Type', 'application/json');

})->add(new AuthMiddleware());


// ============================================================
// POST /api/products/upload-image
// ============================================================
$app->post('/api/products/upload-image', function (Request $request, Response $response) {

    $uploadedFiles = $request->getUploadedFiles();

    if (!isset($uploadedFiles['image'])) {
        $response->getBody()->write(json_encode(['error' => 'No image uploaded']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    $image = $uploadedFiles['image'];

    if ($image->getError() !== UPLOAD_ERR_OK) {
        $response->getBody()->write(json_encode(['error' => 'Upload failed']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    $uploadDir = __DIR__ . '/../../public/uploads/';

    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    $filename = uniqid() . '_' . $image->getClientFilename();
    $targetPath = $uploadDir . $filename;

    try {
        $image->moveTo($targetPath);
    } catch (Exception $e) {
        $response->getBody()->write(json_encode([
            'error' => 'Failed to save image',
            'details' => $e->getMessage()
        ]));
        return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
    }

    $url = '/uploads/' . $filename;

    $response->getBody()->write(json_encode([
        'image_url' => $url
    ]));

    return $response->withHeader('Content-Type', 'application/json');

})->add(new AuthMiddleware());