<?php
// POST /api/cars/save  →  cria ou atualiza um carro (auth obrigatória)
require_once __DIR__ . '/../_lib/auth.php';
require_once __DIR__ . '/../_lib/github.php';
require_once __DIR__ . '/../_lib/slug.php';
require_once __DIR__ . '/../_lib/cors.php';

// Garante slug único: se já existir noutro carro, acrescenta -2, -3, ...
// (sem isto, 2 carros com a mesma marca+modelo geram o mesmo URL e um esconde o outro)
function unique_slug(string $base, array $cars, ?string $selfId = null): string {
  $slug = $base; $n = 2;
  $taken = function ($s) use ($cars, $selfId) {
    foreach ($cars as $c) {
      if (($c['id'] ?? null) !== $selfId && ($c['slug'] ?? null) === $s) return true;
    }
    return false;
  };
  while ($taken($slug)) { $slug = $base . '-' . $n; $n++; }
  return $slug;
}

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
    $merged['slug']      = unique_slug(slugify($merged['marca'] . '-' . $merged['modelo']), $cars, $payload['id']);
    $cars[$existingIdx]  = $merged;
    $updated = $cars;
    $label = "editar {$payload['marca']} {$payload['modelo']}";
  } else {
    $idBase = slugify($payload['marca']) . '-' . substr(slugify($payload['modelo']), 0, 24);
    $id     = $idBase . '-' . uniqid();
    $slug   = unique_slug(slugify($payload['marca'] . '-' . $payload['modelo']), $cars, null);
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

  write_cars($updated, $sha, "admin: $label", $auth['user']['email'] ?? null);
  send_json(['ok' => true]);
} catch (Exception $e) {
  send_error($e->getMessage(), 500);
}
