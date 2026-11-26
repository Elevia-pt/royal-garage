<?php
// Autenticacao do painel admin, feita inteiramente neste servidor.
//
// Substituiu o Supabase Auth em 2026-11. Razao: o free-tier do Supabase
// auto-pausa projetos inativos e deixou o admin em baixo duas vezes, e o
// SDK vinha de um CDN que falhava em rede movel. Agora nao ha dependencias
// externas: as credenciais vivem no .env do Hostinger e o token e' assinado
// aqui.
//
// Credenciais (.env):
//   ADMIN_USERS=email1:pbkdf2_sha256$310000$<salt_hex>$<hash_hex>,email2:...
//   AUTH_SECRET=<string aleatoria longa, usada para assinar os tokens>

require_once __DIR__ . '/env.php';

const AUTH_TOKEN_TTL  = 60 * 60 * 24 * 30;  // 30 dias
const AUTH_PBKDF2_ALGO = 'sha256';

// ---------------------------------------------------------------- base64url

function b64url_encode(string $raw): string {
  return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}

function b64url_decode(string $s) {
  $pad = strlen($s) % 4;
  if ($pad) $s .= str_repeat('=', 4 - $pad);
  return base64_decode(strtr($s, '-_', '+/'), true);
}

// ------------------------------------------------------------- credenciais

// Devolve [email => hash_guardado] a partir do ADMIN_USERS.
function admin_users(): array {
  $raw = (string) env_get('ADMIN_USERS', '');
  $out = [];
  foreach (explode(',', $raw) as $entry) {
    $entry = trim($entry);
    if ($entry === '') continue;
    $sep = strpos($entry, ':');
    if ($sep === false) continue;
    $email = strtolower(trim(substr($entry, 0, $sep)));
    $hash  = trim(substr($entry, $sep + 1));
    if ($email !== '' && $hash !== '') $out[$email] = $hash;
  }
  return $out;
}

// Formato: pbkdf2_sha256$<iteracoes>$<salt_hex>$<hash_hex>
function verify_password(string $password, string $stored): bool {
  $parts = explode('$', $stored);
  if (count($parts) !== 4 || $parts[0] !== 'pbkdf2_sha256') return false;
  $iter = (int) $parts[1];
  $salt = @hex2bin($parts[2]);
  $want = $parts[3];
  if ($iter < 1000 || $salt === false || $want === '') return false;
  $got = hash_pbkdf2(AUTH_PBKDF2_ALGO, $password, $salt, $iter, 0, false);
  return hash_equals($want, $got);   // comparacao resistente a timing
}

// --------------------------------------------------------------- tokens

function auth_secret(): string {
  $s = (string) env_get('AUTH_SECRET', '');
  if (strlen($s) < 24) {
    throw new Exception('AUTH_SECRET em falta ou demasiado curto no .env');
  }
  return $s;
}

function issue_token(string $email): string {
  $now = time();
  $payload = json_encode([
    'sub' => strtolower($email),
    'iat' => $now,
    'exp' => $now + AUTH_TOKEN_TTL,
  ], JSON_UNESCAPED_UNICODE);
  $body = b64url_encode($payload);
  $sig  = b64url_encode(hash_hmac('sha256', $body, auth_secret(), true));
  return $body . '.' . $sig;
}

// Devolve o payload se o token for valido, ou null.
function verify_token(string $token) {
  $dot = strrpos($token, '.');
  if ($dot === false) return null;
  $body = substr($token, 0, $dot);
  $sig  = substr($token, $dot + 1);

  $expected = b64url_encode(hash_hmac('sha256', $body, auth_secret(), true));
  if (!hash_equals($expected, $sig)) return null;

  $json = b64url_decode($body);
  if ($json === false) return null;
  $data = json_decode($json, true);
  if (!is_array($data) || empty($data['sub'])) return null;
  if (!isset($data['exp']) || time() >= (int) $data['exp']) return null;

  // A conta tem de continuar a existir no .env (revogar = tirar de la').
  if (!array_key_exists(strtolower($data['sub']), admin_users())) return null;

  return $data;
}

// ---------------------------------------------------------- check_auth

function check_auth(): array {
  $headers = function_exists('getallheaders') ? getallheaders() : [];
  $auth = '';
  foreach ($headers as $k => $v) {
    if (strcasecmp($k, 'Authorization') === 0) { $auth = $v; break; }
  }
  if ($auth === '' && isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $auth = $_SERVER['HTTP_AUTHORIZATION'];
  }
  if ($auth === '' && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $auth = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];  // alguns setups Apache
  }

  if (!str_starts_with($auth, 'Bearer ')) {
    return ['ok' => false, 'error' => 'Sessão inválida. Faz login outra vez.'];
  }

  try {
    $data = verify_token(trim(substr($auth, 7)));
  } catch (Exception $e) {
    return ['ok' => false, 'error' => $e->getMessage()];
  }
  if (!$data) {
    return ['ok' => false, 'error' => 'Sessão expirada ou inválida. Faz login outra vez.'];
  }

  // Mesma forma que o codigo ja' esperava do Supabase: $auth['user']['email']
  return ['ok' => true, 'user' => ['id' => $data['sub'], 'email' => $data['sub']]];
}
