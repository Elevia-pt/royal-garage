<?php
// POST /api/cars/status  →  muda o estado (available | reserved | sold)
require_once __DIR__ . '/../_lib/auth.php';
require_once __DIR__ . '/../_lib/github.php';
require_once __DIR__ . '/../_lib/cors.php';

const ALLOWED_STATUS = ['available', 'reserved', 'sold'];

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  send_error('Method Not Allowed', 405);
}

$auth = check_auth();
if (!$auth['ok']) send_error($auth['error'], 401);

$payload = json_decode(file_get_contents('php://input'), true) ?: [];
if (empty($payload['id']) || empty($payload['status'])) {
  send_error('id e status obrigatórios', 400);
}
if (!in_array($payload['status'], ALLOWED_STATUS, true)) {
  send_error('status inválido', 400);
}

try {
  $data = read_cars();
  $cars = $data['cars'];
  $sha  = $data['sha'];

  $target = null;
  foreach ($cars as $c) {
    if (($c['id'] ?? null) === $payload['id']) { $target = $c; break; }
  }
  if (!$target) send_error('Carro não encontrado.', 404);

  $updated = array_map(
    fn($c) => ($c['id'] ?? null) === $payload['id']
      ? array_merge($c, ['status' => $payload['status']])
      : $c,
    $cars
  );
  write_cars($updated, $sha, "admin: estado {$payload['status']} — {$target['marca']} {$target['modelo']}", $auth['user']['email'] ?? null);
  send_json(['ok' => true]);
} catch (Exception $e) {
  send_error($e->getMessage(), 500);
}
