<?php
// Helpers para ler/escrever src/_data/cars.json via GitHub Contents API.
// Quando escrevemos, o commit no GitHub dispara o GitHub Actions workflow
// que rebuilda o site e faz upload via FTP ao Hostinger.

require_once __DIR__ . '/env.php';
require_once __DIR__ . '/http.php';

const RG_FILE_PATH = 'src/_data/cars.json';

function gh_config(): array {
  $owner  = env_get('GITHUB_OWNER',  'Elevia-pt');
  $repo   = env_get('GITHUB_REPO',   'royal-garage');
  $branch = env_get('GITHUB_BRANCH', 'main');
  $token  = env_get('GITHUB_TOKEN');
  if (!$token) throw new Exception('GITHUB_TOKEN não está configurado em .env');
  return [
    'api'    => "https://api.github.com/repos/$owner/$repo",
    'branch' => $branch,
    'headers' => [
      'Authorization: Bearer ' . $token,
      'Accept: application/vnd.github+json',
      'X-GitHub-Api-Version: 2022-11-28',
      'User-Agent: royal-garage-admin',
    ],
  ];
}

function read_cars(): array {
  $cfg = gh_config();
  $url = $cfg['api'] . '/contents/' . RG_FILE_PATH . '?ref=' . $cfg['branch'] . '&t=' . time();
  $res = http_get($url, $cfg['headers']);
  if ($res['status'] !== 200) {
    throw new Exception("Falha a ler cars.json no GitHub ({$res['status']}): " . $res['body']);
  }
  $data = json_decode($res['body'], true);
  if (!$data || !isset($data['content'])) {
    throw new Exception('Resposta inesperada do GitHub Contents API.');
  }
  $content = base64_decode(str_replace("\n", '', $data['content']));
  $cars = json_decode($content, true);
  return ['cars' => is_array($cars) ? $cars : [], 'sha' => $data['sha']];
}

function write_cars(array $cars, string $sha, string $message): array {
  $cfg = gh_config();
  $url = $cfg['api'] . '/contents/' . RG_FILE_PATH;
  $body = [
    'message' => $message !== '' ? $message : 'admin: atualizar cars.json',
    'content' => base64_encode(json_encode($cars, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)),
    'sha'     => $sha,
    'branch'  => $cfg['branch'],
  ];
  $headers = array_merge($cfg['headers'], ['Content-Type: application/json']);
  $res = http_put($url, json_encode($body), $headers);
  if ($res['status'] !== 200 && $res['status'] !== 201) {
    throw new Exception("Falha a escrever cars.json no GitHub ({$res['status']}): " . $res['body']);
  }
  return json_decode($res['body'], true) ?: [];
}
