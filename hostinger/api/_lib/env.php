<?php
// Carrega variáveis de ambiente de um ficheiro .env na raiz do site.
// Não usa parse_ini_file para ser tolerante a # dentro de valores (Cloudinary
// secret pode ter caracteres especiais).

function env_get($key, $default = null) {
  static $loaded = null;
  if ($loaded === null) {
    $loaded = [];
    $candidates = [
      __DIR__ . '/../../.env',                    // hostinger/.env
      __DIR__ . '/../../../.env',                 // raiz repo / public_html
      ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/.env' // doc root do Hostinger
    ];
    foreach ($candidates as $p) {
      if ($p && is_readable($p)) {
        foreach (file($p, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
          $trim = trim($line);
          if ($trim === '' || $trim[0] === '#') continue;
          if (strpos($line, '=') === false) continue;
          [$k, $v] = explode('=', $line, 2);
          $k = trim($k);
          $v = trim($v);
          // Tirar aspas simples ou duplas se envolverem todo o valor
          if (strlen($v) >= 2 && (($v[0] === '"' && substr($v, -1) === '"') || ($v[0] === "'" && substr($v, -1) === "'"))) {
            $v = substr($v, 1, -1);
          }
          $loaded[$k] = $v;
        }
        break;
      }
    }
  }
  return $loaded[$key] ?? $default;
}
