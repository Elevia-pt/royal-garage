// Valida o token Supabase chamando o endpoint /auth/v1/user.
// Web Standard: recebe Request + env (Cloudflare Pages Functions).

async function verifyToken(token, env) {
  const url = env.SUPABASE_URL;
  const anon = env.SUPABASE_ANON_KEY;
  if (!url) throw new Error("SUPABASE_URL não configurado nas env vars.");
  if (!anon) throw new Error("SUPABASE_ANON_KEY não configurado nas env vars.");

  const base = url.replace(/\/+$/, "");
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

export async function checkAuth(request, env) {
  const h = request.headers.get("Authorization") || request.headers.get("authorization");
  if (!h || !h.startsWith("Bearer ")) {
    return { ok: false, error: "Sessão inválida. Faz login outra vez." };
  }
  const token = h.slice(7).trim();
  try {
    const user = await verifyToken(token, env);
    if (!user || !user.id) {
      return { ok: false, error: "Sessão expirada ou inválida. Faz login outra vez." };
    }
    return { ok: true, user };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
