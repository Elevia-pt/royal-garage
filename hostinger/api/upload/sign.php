<?php
// GET /api/upload/sign  →  devolve parâmetros assinados para o frontend
// fazer upload direto ao Cloudinary (sem passar pelo nosso servidor).
require_once __DIR__ . '/../_lib/auth.php';
require_once __DIR__ . '/../_lib/env.php';
require_once __DIR__ . '/../_lib/cors.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
  send_error('Method Not Allowed', 405);
}

$auth = check_auth();
if (!$auth['ok']) send_error($auth['error'], 401);

$cloudName = env_get('CLOUDINARY_CLOUD_NAME');
$apiKey    = env_get('CLOUDINARY_API_KEY');
$apiSecret = env_get('CLOUDINARY_API_SECRET');

if (!$cloudName || !$apiKey || !$apiSecret) {
  send_error(
    'Cloudinary não configurado. Define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET em .env.',
    500
  );
}

$folder    = 'royal-garage/cars';
$timestamp = time();
// Cloudinary signature: SHA-1 de "folder=X&timestamp=Y" + apiSecret
$paramsToSign = "folder=$folder&timestamp=$timestamp";
$signature    = sha1($paramsToSign . $apiSecret);

send_json([
  'cloudName' => $cloudName,
  'apiKey'    => $apiKey,
  'timestamp' => $timestamp,
  'folder'    => $folder,
  'signature' => $signature,
  'uploadUrl' => "https://api.cloudinary.com/v1_1/$cloudName/image/upload",
]);
