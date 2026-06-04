<?php
// Slugify PT-aware sem depender de ext/intl (que pode não estar no Hostinger).

function slugify($str): string {
  $str = (string)$str;
  if ($str === '') return '';
  $str = mb_strtolower($str, 'UTF-8');
  // Map manual de acentos comuns (PT + FR + ES)
  $map = [
    'á'=>'a','à'=>'a','â'=>'a','ã'=>'a','ä'=>'a','å'=>'a',
    'é'=>'e','è'=>'e','ê'=>'e','ë'=>'e',
    'í'=>'i','ì'=>'i','î'=>'i','ï'=>'i',
    'ó'=>'o','ò'=>'o','ô'=>'o','õ'=>'o','ö'=>'o',
    'ú'=>'u','ù'=>'u','û'=>'u','ü'=>'u',
    'ç'=>'c','ñ'=>'n','ý'=>'y','ÿ'=>'y',
  ];
  $str = strtr($str, $map);
  $str = preg_replace('/[^a-z0-9]+/', '-', $str);
  return trim($str, '-');
}
