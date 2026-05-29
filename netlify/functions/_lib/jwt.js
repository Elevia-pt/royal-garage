// JWT minimalista (HS256) — sem dependências externas
const crypto = require("crypto");

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error("JWT_SECRET não configurado nas env vars do Netlify (mínimo 16 caracteres).");
  }
  return s;
}

function b64u(input) {
  return Buffer.from(input).toString("base64url");
}

exports.sign = function (payload, expiresInSeconds) {
  const header = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64u(
    JSON.stringify({
      ...payload,
      iat: now,
      exp: now + (expiresInSeconds || 7 * 24 * 60 * 60) // 7 dias por defeito
    })
  );
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
};

exports.verify = function (token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, b, s] = parts;
  let expected;
  try {
    expected = crypto
      .createHmac("sha256", getSecret())
      .update(`${h}.${b}`)
      .digest("base64url");
  } catch {
    return null;
  }
  if (s.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(b, "base64url").toString());
  } catch {
    return null;
  }
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
};
