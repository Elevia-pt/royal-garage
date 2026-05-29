// Verifica o JWT do header Authorization: Bearer <token>
const { verify } = require("./jwt");

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
