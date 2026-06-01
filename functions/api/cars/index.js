// GET /api/cars  →  devolve todos os carros (auth obrigatória)
import { checkAuth } from "../../_lib/auth.js";
import { readCars } from "../../_lib/github.js";

export async function onRequestGet({ request, env }) {
  const auth = await checkAuth(request, env);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: 401 });
  try {
    const { cars } = await readCars(env);
    return Response.json({ cars }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
