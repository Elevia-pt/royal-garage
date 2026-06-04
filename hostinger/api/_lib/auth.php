<?php
// Valida o token Supabase chamando o endpoint /auth/v1/user.
// Não precisa do JWT secret — a Supabase confirma se o token é válido.

require_once __DIR__ . '/env.php';
require_once __DIR__ . '/http.php';

function verify_supabase_token(string $token) {
  $base = rtrim(env_get('SUPABASE_URL'), '/');
  $anon = env_get('SUPABASE_ANON_KEY');
  if (!$base) throw new Exception('SUPABASE_URL não está configurado em .env');
  if (!$anon) throw new Exception('SUPABASE_ANON_KEY não está configurado em .env');

  $res = http_get($base . '/auth/v1/user', [
    'Authorization: Bearer ' . $token,
    'apikey: ' . $anon,
  ]);
  if ($res['status'] !== 200) return null;
  $data = json_decode($res['body'], true);
  return $data ?: null;
}

function check_auth(): array {
  // Apanhar Authorization header (case-insensitive)
  $headers = function_exists('getallheaders') ? getallheaders() : [];
  $auth = '';
  foreach ($headers as $k => $v) {
    if (strcasecmp($k, 'Authorization') === 0) { $auth = $v; break; }
  }
  if ($auth === '' && isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $auth = $_SERVER['HTTP_AUTHORIZATION'];
  }

  if (!str_starts_with($auth, 'Bearer ')) {
    return ['ok' => false, 'error' => 'Sessão inválida. Faz login outra vez.'];
  }
  $token = trim(substr($auth, 7));
  try {
    $user = verify_supabase_token($token);
    if (!$user || empty($user['id'])) {
      return ['ok' => false, 'error' => 'Sessão expirada ou inválida. Faz login outra vez.'];
    }
    return ['ok' => true, 'user' => $user];
  } catch (Exception $e) {
    return ['ok' => false, 'error' => $e->getMessage()];
  }
}
