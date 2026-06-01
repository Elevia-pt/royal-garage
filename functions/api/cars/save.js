// POST /api/cars/save  →  cria ou atualiza um carro (auth obrigatória)
import { checkAuth } from "../../_lib/auth.js";
import { readCars, writeCars } from "../../_lib/github.js";
import { slugify } from "../../_lib/slug.js";

export async function onRequestPost({ request, env }) {
  const auth = await checkAuth(request, env);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: 401 });

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!payload.marca || !payload.modelo) {
    return Response.json({ error: "Marca e modelo são obrigatórios." }, { status: 400 });
  }

  try {
    const { cars, sha } = await readCars(env);
    const now = new Date().toISOString().slice(0, 10);
    let updated;
    let label;

    if (payload.id && cars.find((c) => c.id === payload.id)) {
      updated = cars.map((c) => {
        if (c.id !== payload.id) return c;
        const merged = { ...c, ...payload, updatedAt: now };
        merged.slug = slugify(`${merged.marca}-${merged.modelo}`);
        return merged;
      });
      label = `editar ${payload.marca} ${payload.modelo}`;
    } else {
      const idBase = `${slugify(payload.marca)}-${slugify(payload.modelo).slice(0, 24)}`;
      const id = `${idBase}-${Date.now().toString(36)}`;
      const slug = slugify(`${payload.marca}-${payload.modelo}`);
      const newCar = {
        id,
        slug,
        ...payload,
        status: payload.status || "available",
        featured: payload.featured === true,
        photos: payload.photos || [],
        createdAt: now
      };
      newCar.id = id;
      newCar.slug = slug;
      updated = [newCar, ...cars];
      label = `adicionar ${payload.marca} ${payload.modelo}`;
    }

    await writeCars(updated, sha, `admin: ${label}`, env);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
