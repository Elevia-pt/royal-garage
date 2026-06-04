<?php
// POST /api/cars/save  →  cria ou atualiza um carro (auth obrigatória)
require_once __DIR__ . '/../_lib/auth.php';
require_once __DIR__ . '/../_lib/github.php';
require_once __DIR__ . '/../_lib/slug.php';
require_once __DIR__ . '/../_lib/cors.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  send_error('Method Not Allowed', 405);
}

$auth = check_auth();
if (!$auth['ok']) send_error($auth['error'], 401);

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) send_error('JSON inválido', 400);

if (empty($payload['marca']) || empty($payload['modelo'])) {
  send_error('Marca e modelo são obrigatórios.', 400);
}

try {
  $data = read_cars();
  $cars = $data['cars'];
  $sha  = $data['sha'];
  $now  = date('Y-m-d');

  $existingIdx = null;
  if (!empty($payload['id'])) {
    foreach ($cars as $i => $c) {
      if (($c['id'] ?? null) === $payload['id']) { $existingIdx = $i; break; }
    }
  }

  if ($existingIdx !== null) {
    $merged = array_merge($cars[$existingIdx], $payload);
    $merged['updatedAt'] = $now;
    $merged['slug']      = slugify($merged['marca'] . '-' . $merged['modelo']);
    $cars[$existingIdx]  = $merged;
    $updated = $cars;
    $label = "editar {$payload['marca']} {$payload['modelo']}";
  } else {
    $idBase = slugify($payload['marca']) . '-' . substr(slugify($payload['modelo']), 0, 24);
    $id     = $idBase . '-' . uniqid();
    $slug   = slugify($payload['marca'] . '-' . $payload['modelo']);
    $newCar = array_merge($payload, [
      'id'        => $id,
      'slug'      => $slug,
      'status'    => $payload['status'] ?? 'available',
      'featured'  => ($payload['featured'] ?? false) === true,
      'photos'    => $payload['photos'] ?? [],
      'createdAt' => $now,
    ]);
    $newCar['id']   = $id;
    $newCar['slug'] = $slug;
    $updated = array_merge([$newCar], $cars);
    $label = "adicionar {$payload['marca']} {$payload['modelo']}";
  }

  write_cars($updated, $sha, "admin: $label");
  send_json(['ok' => true]);
} catch (Exception $e) {
  send_error($e->getMessage(), 500);
}
