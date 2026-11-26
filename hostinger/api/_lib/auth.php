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
require_once __DIR__ . '/users.php';

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

// Devolve [email => hash_guardado]. A fonte e' o admin-users.json (ver
// users.php), semeado a partir do ADMIN_USERS do .env na primeira vez.
function admin_users(): array {
  $out = [];
  foreach (users_load() as $email => $u) {
    if (!empty($u['hash'])) $out[$email] = $u['hash'];
  }
  return $out;
}

// A conta ainda esta' com a password inicial e tem de a trocar?
function user_must_change(string $email): bool {
  $u = users_load()[strtolower(trim($email))] ?? null;
  return (bool) ($u['must_change'] ?? false);
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

// Valida so' o token. Usado pelo endpoint de troca de password, que tem de
// funcionar precisamente enquanto a troca esta' pendente.
function check_auth_token(): array {
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

  $email = strtolower($data['sub']);
  // Mesma forma que o codigo ja' esperava do Supabase: $auth['user']['email']
  return ['ok' => true, 'user' => ['id' => $email, 'email' => $email]];
}

// Usado por toda a API. Alem do token, exige que a password inicial ja'
// tenha sido trocada: enquanto estiver pendente, a conta so' pode mudar a
// password e mais nada.
function check_auth(): array {
  $res = check_auth_token();
  if (!$res['ok']) return $res;
  if (user_must_change($res['user']['email'])) {
    return ['ok' => false, 'error' => 'Tens de definir uma password nova antes de continuares.'];
  }
  return $res;
}
