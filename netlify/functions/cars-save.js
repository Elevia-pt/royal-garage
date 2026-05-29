// POST /api/cars/save  →  cria ou atualiza um carro (auth obrigatória)
const { checkAuth } = require("./_lib/auth");
const { readCars, writeCars } = require("./_lib/github");
const { slugify } = require("./_lib/slug");

exports.handler = async (event) => {
  const auth = checkAuth(event);
  if (!auth.ok) {
    return { statusCode: 401, body: JSON.stringify({ error: auth.error }) };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "JSON inválido" }) };
  }

  if (!payload.marca || !payload.modelo) {
    return { statusCode: 400, body: JSON.stringify({ error: "Marca e modelo são obrigatórios." }) };
  }

  try {
    const { cars, sha } = await readCars();
    const now = new Date().toISOString().slice(0, 10);
    let updated;
    let label;

    if (payload.id && cars.find((c) => c.id === payload.id)) {
      // Editar existente
      updated = cars.map((c) => {
        if (c.id !== payload.id) return c;
        const merged = { ...c, ...payload, updatedAt: now };
        merged.slug = slugify(`${merged.marca}-${merged.modelo}`);
        return merged;
      });
      label = `editar ${payload.marca} ${payload.modelo}`;
    } else {
      // Adicionar novo
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
      // garantir que id/slug não foram sobrescritos pelo spread
      newCar.id = id;
      newCar.slug = slug;
      updated = [newCar, ...cars];
      label = `adicionar ${payload.marca} ${payload.modelo}`;
    }

    await writeCars(updated, sha, `admin: ${label}`);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
