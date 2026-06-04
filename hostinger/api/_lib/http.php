<?php
// Wrapper minimalista cURL para chamadas HTTP server-side
// (Supabase, GitHub API). Sem dependências externas.

function http_request($method, $url, $body = null, array $headers = []) {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST  => $method,
    CURLOPT_HTTPHEADER     => $headers,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_SSL_VERIFYPEER => true,
  ]);
  if ($body !== null) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
  }
  $resp = curl_exec($ch);
  if ($resp === false) {
    $err = curl_error($ch);
    curl_close($ch);
    throw new Exception("cURL error: $err");
  }
  $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  return ['status' => $status, 'body' => $resp];
}

function http_get($url, array $headers = []) {
  return http_request('GET', $url, null, $headers);
}

function http_put($url, $body, array $headers = []) {
  return http_request('PUT', $url, $body, $headers);
}
