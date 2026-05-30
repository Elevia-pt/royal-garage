// Valida o token Supabase chamando o endpoint /auth/v1/user.
// Vantagem: não precisamos do JWT secret nem de saber HS256/RS256.
// A própria Supabase confirma se o token é válido.

async function verifyToken(token) {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url) throw new Error("SUPABASE_URL não configurado nas env vars do Netlify.");
  if (!anon) throw new Error("SUPABASE_ANON_KEY não configurado nas env vars do Netlify.");

  const base = url.replace(/\/+$/, ""); // tira barra(s) final(is) se existir
  const res = await fetch(`${base}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anon
    }
  });
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

exports.checkAuth = async (event) => {
  const headers = event && event.headers ? event.headers : {};
  const h = headers.authorization || headers.Authorization;
  if (!h || !h.startsWith("Bearer ")) {
    return { ok: false, error: "Sessão inválida. Faz login outra vez." };
  }
  const token = h.slice(7).trim();
  try {
    const user = await verifyToken(token);
    if (!user || !user.id) {
      return { ok: false, error: "Sessão expirada ou inválida. Faz login outra vez." };
    }
    return { ok: true, user };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};
