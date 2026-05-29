// POST /api/cars/status  →  muda o estado (available | reserved | sold)
const { checkAuth } = require("./_lib/auth");
const { readCars, writeCars } = require("./_lib/github");

const ALLOWED = ["available", "reserved", "sold"];

exports.handler = async (event) => {
  const auth = checkAuth(event);
  if (!auth.ok) {
    return { statusCode: 401, body: JSON.stringify({ error: auth.error }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "JSON inválido" }) };
  }
  if (!payload.id || !payload.status) {
    return { statusCode: 400, body: JSON.stringify({ error: "id e status obrigatórios" }) };
  }
  if (!ALLOWED.includes(payload.status)) {
    return { statusCode: 400, body: JSON.stringify({ error: "status inválido" }) };
  }

  try {
    const { cars, sha } = await readCars();
    const target = cars.find((c) => c.id === payload.id);
    if (!target) {
      return { statusCode: 404, body: JSON.stringify({ error: "Carro não encontrado." }) };
    }
    const updated = cars.map((c) =>
      c.id === payload.id ? { ...c, status: payload.status } : c
    );
    await writeCars(
      updated,
      sha,
      `admin: estado ${payload.status} — ${target.marca} ${target.modelo}`
    );
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
