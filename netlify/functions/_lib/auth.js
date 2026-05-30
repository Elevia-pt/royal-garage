// Verifica o JWT da Supabase (HS256, secret partilhado).
// O secret vem das env vars do Netlify (SUPABASE_JWT_SECRET).
const crypto = require("crypto");

function getSecret() {
  const s = process.env.SUPABASE_JWT_SECRET;
  if (!s) {
    throw new Error("SUPABASE_JWT_SECRET não configurado nas env vars do Netlify.");
  }
  return s;
}

function b64uToBuffer(s) {
  // base64url → base64 (substitui caracteres e adiciona padding)
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return Buffer.from(b64 + pad, "base64");
}

function verify(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, b, s] = parts;
  let expected;
  try {
    expected = crypto.createHmac("sha256", getSecret()).update(`${h}.${b}`).digest("base64url");
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
    payload = JSON.parse(b64uToBuffer(b).toString("utf8"));
  } catch {
    return null;
  }
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

exports.checkAuth = (event) => {
  const headers = event && event.headers ? event.headers : {};
  const h = headers.authorization || headers.Authorization;
  if (!h || !h.startsWith("Bearer ")) {
    return { ok: false, error: "Sessão inválida. Faz login outra vez." };
  }
  const token = h.slice(7).trim();
  const payload = verify(token);
  if (!payload) {
    return { ok: false, error: "Sessão expirada ou inválida. Faz login outra vez." };
  }
  return { ok: true, user: payload };
};
