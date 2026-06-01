// POST /api/cars/status  →  muda o estado (available | reserved | sold)
import { checkAuth } from "../../_lib/auth.js";
import { readCars, writeCars } from "../../_lib/github.js";

const ALLOWED = ["available", "reserved", "sold"];

export async function onRequestPost({ request, env }) {
  const auth = await checkAuth(request, env);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: 401 });

  let payload;
  try { payload = await request.json(); } catch { payload = {}; }
  if (!payload.id || !payload.status) {
    return Response.json({ error: "id e status obrigatórios" }, { status: 400 });
  }
  if (!ALLOWED.includes(payload.status)) {
    return Response.json({ error: "status inválido" }, { status: 400 });
  }

  try {
    const { cars, sha } = await readCars(env);
    const target = cars.find((c) => c.id === payload.id);
    if (!target) return Response.json({ error: "Carro não encontrado." }, { status: 404 });
    const updated = cars.map((c) =>
      c.id === payload.id ? { ...c, status: payload.status } : c
    );
    await writeCars(
      updated,
      sha,
      `admin: estado ${payload.status} — ${target.marca} ${target.modelo}`,
      env
    );
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
