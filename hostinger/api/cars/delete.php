<?php
// POST /api/cars/delete  →  remove um carro (auth obrigatória)
require_once __DIR__ . '/../_lib/auth.php';
require_once __DIR__ . '/../_lib/github.php';
require_once __DIR__ . '/../_lib/cors.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  send_error('Method Not Allowed', 405);
}

$auth = check_auth();
if (!$auth['ok']) send_error($auth['error'], 401);

$payload = json_decode(file_get_contents('php://input'), true) ?: [];
if (empty($payload['id'])) send_error('id obrigatório', 400);

try {
  $data = read_cars();
  $cars = $data['cars'];
  $sha  = $data['sha'];

  $target = null;
  foreach ($cars as $c) {
    if (($c['id'] ?? null) === $payload['id']) { $target = $c; break; }
  }
  if (!$target) send_error('Carro não encontrado.', 404);

  $updated = array_values(array_filter($cars, fn($c) => ($c['id'] ?? null) !== $payload['id']));
  write_cars($updated, $sha, "admin: remover {$target['marca']} {$target['modelo']}", $auth['user']['email'] ?? null);
  send_json(['ok' => true]);
} catch (Exception $e) {
  send_error($e->getMessage(), 500);
}
