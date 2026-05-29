// GET /api/upload/sign  →  devolve parâmetros assinados para o frontend
// fazer upload direto ao Cloudinary (sem passar pelo nosso servidor).
const crypto = require("crypto");
const { checkAuth } = require("./_lib/auth");

exports.handler = async (event) => {
  const auth = checkAuth(event);
  if (!auth.ok) {
    return { statusCode: 401, body: JSON.stringify({ error: auth.error }) };
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Cloudinary não configurado. Define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET nas env vars do Netlify."
      })
    };
  }

  const folder = "royal-garage/cars";
  const timestamp = Math.round(Date.now() / 1000);

  // Cloudinary signature: SHA-1 de "folder=X&timestamp=Y" + apiSecret
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash("sha1")
    .update(paramsToSign + apiSecret)
    .digest("hex");

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({
      cloudName,
      apiKey,
      timestamp,
      folder,
      signature,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
    })
  };
};
