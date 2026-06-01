// POST /api/cars/featured  →  marca um carro como "featured" e desmarca os outros
import { checkAuth } from "../../_lib/auth.js";
import { readCars, writeCars } from "../../_lib/github.js";

export async function onRequestPost({ request, env }) {
  const auth = await checkAuth(request, env);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: 401 });

  let payload;
  try { payload = await request.json(); } catch { payload = {}; }
  if (!payload.id) return Response.json({ error: "id obrigatório" }, { status: 400 });

  try {
    const { cars, sha } = await readCars(env);
    const target = cars.find((c) => c.id === payload.id);
    if (!target) return Response.json({ error: "Carro não encontrado." }, { status: 404 });
    const updated = cars.map((c) => ({ ...c, featured: c.id === payload.id }));
    await writeCars(updated, sha, `admin: definir destaque — ${target.marca} ${target.modelo}`, env);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
