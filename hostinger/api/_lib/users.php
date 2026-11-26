<?php
// Contas do painel admin.
//
// Vivem em admin-users.json (ao lado do .env) e nao no proprio .env, porque
// o PHP precisa de escrever aqui quando alguem muda a password. O .env guarda
// o token do GitHub e as chaves do Cloudinary: uma escrita falhada nesse
// ficheiro partia o site inteiro. Aqui, o pior caso afeta so' os logins.
//
// O ficheiro e' semeado na primeira utilizacao a partir do ADMIN_USERS do
// .env, com must_change = true, para a password inicial (que passa por
// WhatsApp ou email ate' chegar ao cliente) nunca ficar a ser a definitiva.

require_once __DIR__ . '/env.php';

const USERS_FILE_NAME = 'admin-users.json';
const PBKDF2_ITER     = 310000;

function users_file(): string {
  $candidates = [
    __DIR__ . '/../../' . USERS_FILE_NAME,      // hostinger/
    __DIR__ . '/../../../' . USERS_FILE_NAME,   // raiz
    ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/' . USERS_FILE_NAME,
  ];
  foreach ($candidates as $p) {
    if ($p && is_file($p)) return $p;
  }
  // Ainda nao existe: criar ao lado do .env (raiz do site).
  $root = $_SERVER['DOCUMENT_ROOT'] ?? (__DIR__ . '/../..');
  return rtrim($root, "/\\") . '/' . USERS_FILE_NAME;
}

// Le o ADMIN_USERS do .env: "email:hash,email:hash"
function users_from_env(): array {
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

// [email => ['hash' => ..., 'must_change' => bool]]
function users_load(): array {
  $f = users_file();
  if (is_readable($f)) {
    $d = json_decode((string) @file_get_contents($f), true);
    if (is_array($d) && !empty($d['users']) && is_array($d['users'])) {
      return $d['users'];
    }
  }
  // Primeira vez: semear a partir do .env, a pedir troca de password.
  $seed = [];
  foreach (users_from_env() as $email => $hash) {
    $seed[$email] = ['hash' => $hash, 'must_change' => true];
  }
  if ($seed) @users_save($seed);   // se nao gravar, segue em memoria
  return $seed;
}

// Escrita atomica: grava num temporario e so' depois substitui, para o
// ficheiro nunca ficar a meio se algo falhar.
function users_save(array $users): bool {
  $f    = users_file();
  $tmp  = $f . '.tmp';
  $json = json_encode(['users' => $users], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  if ($json === false) return false;
  if (@file_put_contents($tmp, $json, LOCK_EX) === false) return false;
  if (!@rename($tmp, $f)) { @unlink($tmp); return false; }
  return true;
}

function users_set_password(string $email, string $plain): bool {
  $email = strtolower(trim($email));
  $users = users_load();
  if (!isset($users[$email])) return false;
  $salt = random_bytes(16);
  $hash = hash_pbkdf2('sha256', $plain, $salt, PBKDF2_ITER, 0, false);
  $users[$email] = [
    'hash'        => 'pbkdf2_sha256$' . PBKDF2_ITER . '$' . bin2hex($salt) . '$' . $hash,
    'must_change' => false,
    'updated_at'  => gmdate('c'),
  ];
  return users_save($users);
}
