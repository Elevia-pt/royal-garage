// GET /api/upload/sign  →  devolve parâmetros assinados para o frontend
// fazer upload direto ao Cloudinary (sem passar pelo nosso servidor).
// Web Standard: usa crypto.subtle em vez de require('crypto').
import { checkAuth } from "../../_lib/auth.js";

async function sha1Hex(str) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function onRequestGet({ request, env }) {
  const auth = await checkAuth(request, env);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: 401 });

  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return Response.json(
      {
        error:
          "Cloudinary não configurado. Define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET nas env vars."
      },
      { status: 500 }
    );
  }

  const folder = "royal-garage/cars";
  const timestamp = Math.round(Date.now() / 1000);

  // Cloudinary signature: SHA-1 de "folder=X&timestamp=Y" + apiSecret
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = await sha1Hex(paramsToSign + apiSecret);

  return Response.json(
    {
      cloudName,
      apiKey,
      timestamp,
      folder,
      signature,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
