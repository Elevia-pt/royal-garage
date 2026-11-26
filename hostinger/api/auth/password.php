<?php
// POST /api/auth/password  ->  { password }  =>  { ok: true }
//
// Define a password da conta autenticada. Usa check_auth_token() (e nao
// check_auth()) de proposito: tem de funcionar precisamente quando a troca
// esta' pendente, que e' o unico caso em que o resto da API esta' fechada.

require_once __DIR__ . '/../_lib/auth.php';
require_once __DIR__ . '/../_lib/users.php';
require_once __DIR__ . '/../_lib/cors.php';

const PASSWORD_MIN = 8;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  send_error('Method Not Allowed', 405);
}

$auth = check_auth_token();
if (!$auth['ok']) send_error($auth['error'], 401);
$email = $auth['user']['email'];

$payload = json_decode(file_get_contents('php://input'), true);
$nova    = (string) ($payload['password'] ?? '');

if (strlen($nova) < PASSWORD_MIN) {
  send_error('A password tem de ter pelo menos ' . PASSWORD_MIN . ' caracteres.', 400);
}
if (trim($nova) === '') {
  send_error('A password não pode ser só espaços.', 400);
}

try {
  // Nao deixar ficar com a password que ja' tinha (o objetivo da troca e'
  // exatamente deixar de usar a inicial, que circulou por mensagem).
  $atual = admin_users()[$email] ?? null;
  if ($atual && verify_password($nova, $atual)) {
    send_error('Escolhe uma password diferente da atual.', 400);
  }

  if (!users_set_password($email, $nova)) {
    send_error(
      'Não foi possível guardar a password no servidor. O ficheiro admin-users.json pode não ter permissões de escrita.',
      500
    );
  }

  // Token novo: o antigo foi emitido antes da troca.
  send_json(['ok' => true, 'token' => issue_token($email), 'email' => $email]);
} catch (Exception $e) {
  send_error($e->getMessage(), 500);
}
