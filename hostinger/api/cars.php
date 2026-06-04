<?php
// GET /api/cars  →  devolve todos os carros (auth obrigatória)
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/github.php';
require_once __DIR__ . '/_lib/cors.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
  send_error('Method Not Allowed', 405);
}

$auth = check_auth();
if (!$auth['ok']) send_error($auth['error'], 401);

try {
  $data = read_cars();
  send_json(['cars' => $data['cars']]);
} catch (Exception $e) {
  send_error($e->getMessage(), 500);
}
