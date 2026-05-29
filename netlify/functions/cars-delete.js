// POST /api/cars/delete  →  remove um carro (auth obrigatória)
const { checkAuth } = require("./_lib/auth");
const { readCars, writeCars } = require("./_lib/github");

exports.handler = async (event, context) => {
  const auth = checkAuth(context);
  if (!auth.ok) {
    return { statusCode: 401, body: JSON.stringify({ error: auth.error }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "JSON inválido" }) };
  }
  if (!payload.id) {
    return { statusCode: 400, body: JSON.stringify({ error: "id obrigatório" }) };
  }

  try {
    const { cars, sha } = await readCars();
    const target = cars.find((c) => c.id === payload.id);
    if (!target) {
      return { statusCode: 404, body: JSON.stringify({ error: "Carro não encontrado." }) };
    }
    const updated = cars.filter((c) => c.id !== payload.id);
    await writeCars(updated, sha, `admin: remover ${target.marca} ${target.modelo}`);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
