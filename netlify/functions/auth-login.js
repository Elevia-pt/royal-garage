// POST /api/auth/login  →  recebe { password } e devolve { token }
const crypto = require("crypto");
const { sign } = require("./_lib/jwt");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "JSON inválido" }) };
  }

  const submitted = String(payload.password || "");
  const expected = process.env.ADMIN_PASSWORD || "";

  if (!expected) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "ADMIN_PASSWORD não configurado nas env vars do Netlify."
      })
    };
  }

  // Comparação em tempo constante
  const aBuf = Buffer.from(submitted);
  const bBuf = Buffer.from(expected);
  let ok = false;
  if (aBuf.length === bBuf.length) {
    try {
      ok = crypto.timingSafeEqual(aBuf, bBuf);
    } catch {
      ok = false;
    }
  }
  if (!ok) {
    // Pequeno delay para suavizar bruteforce
    await new Promise((r) => setTimeout(r, 600));
    return { statusCode: 401, body: JSON.stringify({ error: "Password incorreta." }) };
  }

  try {
    const token = sign({ sub: "admin", role: "admin" });
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ token })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
