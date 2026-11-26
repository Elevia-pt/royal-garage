<?php
// POST /api/auth/login  ->  { email, password }  =>  { token, email }
//
// Substitui o signInWithPassword do Supabase. As credenciais estao no .env
// (ADMIN_USERS) e o token e' assinado com AUTH_SECRET.

require_once __DIR__ . '/../_lib/auth.php';
require_once __DIR__ . '/../_lib/cors.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  send_error('Method Not Allowed', 405);
}

// ------------------------------------------------ travao a tentativas a' bruta
// O Supabase limitava isto por nos. Agora a password e' validada no nosso
// servidor, por isso e' preciso travar quem tente adivinhar. Contador por IP
// em ficheiro temporario (sem BD): 8 falhas em 15 min = bloqueado 15 min.

const LOGIN_MAX_FAILS = 8;
const LOGIN_WINDOW    = 900;   // 15 minutos

function throttle_file(): string {
  $ip = $_SERVER['REMOTE_ADDR'] ?? 'desconhecido';
  return sys_get_temp_dir() . '/rg_login_' . md5($ip) . '.json';
}

function throttle_check(): void {
  $f = throttle_file();
  if (!is_readable($f)) return;
  $d = json_decode((string) @file_get_contents($f), true);
  if (!is_array($d)) return;
  if (time() - (int) ($d['first'] ?? 0) > LOGIN_WINDOW) return;   // janela expirou
  if ((int) ($d['fails'] ?? 0) >= LOGIN_MAX_FAILS) {
    $faltam = LOGIN_WINDOW - (time() - (int) $d['first']);
    send_error(
      'Demasiadas tentativas falhadas. Aguarda ' . max(1, (int) ceil($faltam / 60)) . ' minutos e tenta outra vez.',
      429
    );
  }
}

function throttle_fail(): void {
  $f = throttle_file();
  $d = json_decode((string) @file_get_contents($f), true);
  if (!is_array($d) || time() - (int) ($d['first'] ?? 0) > LOGIN_WINDOW) {
    $d = ['first' => time(), 'fails' => 0];
  }
  $d['fails'] = (int) $d['fails'] + 1;
  @file_put_contents($f, json_encode($d), LOCK_EX);
}

function throttle_reset(): void {
  @unlink(throttle_file());
}

// ------------------------------------------------------------------ login

throttle_check();

$payload  = json_decode(file_get_contents('php://input'), true);
$email    = strtolower(trim((string) ($payload['email'] ?? '')));
$password = (string) ($payload['password'] ?? '');

if ($email === '' || $password === '') {
  send_error('Indica o email e a password.', 400);
}

try {
  $users = admin_users();
  if (!$users) {
    send_error('Nenhuma conta configurada no servidor. Contacta o administrador.', 500);
  }
  auth_secret();   // rebenta ja' aqui se o AUTH_SECRET faltar

  $stored = $users[$email] ?? null;

  // Verifica a password mesmo quando o email nao existe, com um hash falso,
  // para o tempo de resposta nao revelar quais os emails validos.
  $ok = $stored
    ? verify_password($password, $stored)
    : (verify_password($password, 'pbkdf2_sha256$310000$00$00') && false);

  if (!$ok) {
    throttle_fail();
    send_error('Email ou password incorretos.', 401);
  }

  throttle_reset();
  send_json([
    'token'       => issue_token($email),
    'email'       => $email,
    // Password inicial por trocar: o painel manda-o definir uma nova antes
    // de o deixar entrar.
    'mustChange'  => user_must_change($email),
  ]);
} catch (Exception $e) {
  send_error($e->getMessage(), 500);
}
