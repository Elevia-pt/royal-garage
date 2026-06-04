<?php
// Helpers de resposta JSON (mesmo host que o site, sem CORS necessário).

function send_json($data, int $status = 200): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function send_error(string $msg, int $status = 500): void {
  send_json(['error' => $msg], $status);
}
