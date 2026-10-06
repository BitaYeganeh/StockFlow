<?php
require __DIR__ . '/../vendor/autoload.php';
use Slim\Factory\AppFactory;

// Settings come from api/.env locally, or from the host's environment
// (Render) where there is no .env file
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();
foreach (getenv() as $key => $value) {
    $_ENV[$key] ??= $value;
}
// On Render the front end's address arrives as a bare host name
if (empty($_ENV['CLIENT_URL']) && !empty($_ENV['CLIENT_HOST'])) {
    $_ENV['CLIENT_URL'] = 'https://' . $_ENV['CLIENT_HOST'];
}
if (empty($_ENV['SITE_URL']) && !empty($_ENV['RENDER_EXTERNAL_URL'])) {
    $_ENV['SITE_URL'] = $_ENV['RENDER_EXTERNAL_URL'];
}

// Show error details only while developing
$debug = ($_ENV['APP_DEBUG'] ?? 'true') === 'true';
error_reporting(E_ALL);
ini_set('display_errors', $debug ? '1' : '0');

$app = AppFactory::create();
$app->options('/{routes:.+}', function ($request, $response) {
    return $response;
});


// ------------------------
// Middlewares
// ------------------------
$app->addBodyParsingMiddleware();
$app->addRoutingMiddleware();
$app->addErrorMiddleware($debug, true, true);

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