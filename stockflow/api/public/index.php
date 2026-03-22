<?php
require __DIR__ . '/../vendor/autoload.php';
use Slim\Factory\AppFactory;

error_reporting(E_ALL);
ini_set('display_errors', 1);

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->load();

$app = AppFactory::create();
$app->options('/{routes:.+}', function ($request, $response) {
    return $response;
});


// ------------------------
// Middlewares
// ------------------------
$app->addBodyParsingMiddleware();
$app->addRoutingMiddleware();
$app->addErrorMiddleware(true, true, true);

// ✅ CORS middleware
$app->add(function ($request, $handler) {
    $response = $handler->handle($request);

    $origin = $_ENV['CLIENT_URL'] ?? 'http://localhost:5173';

    $response = $response
        ->withHeader('Access-Control-Allow-Origin', $origin)
        ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

    // If this is a preflight request, return 200 immediately
    if ($request->getMethod() === 'OPTIONS') {
        return $response->withStatus(200);
    }

    return $response;
});

// ------------------------
// Routes
// ------------------------
require __DIR__ . '/../src/Routes/auth.php';
require __DIR__ . '/../src/Routes/products.php';
require __DIR__ . '/../src/Routes/orders.php';
require __DIR__ . '/../src/Routes/stock.php';
require __DIR__ . '/../src/Routes/ai.php';
require __DIR__ . '/../src/Routes/dashboard.php';

// Redirect root to frontend
$app->get('/', function ($request, $response) {
    $frontendUrl = $_ENV['CLIENT_URL'] ?? 'http://localhost:5173';
    return $response
        ->withHeader('Location', $frontendUrl)
        ->withStatus(302);
});

// ------------------------
// Run the app
// ------------------------
$app->run();