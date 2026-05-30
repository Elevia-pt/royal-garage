// GET /api/cars  →  devolve todos os carros (auth obrigatória)
const { checkAuth } = require("./_lib/auth");
const { readCars } = require("./_lib/github");

exports.handler = async (event) => {
  const auth = await checkAuth(event);
  if (!auth.ok) {
    return { statusCode: 401, body: JSON.stringify({ error: auth.error }) };
  }
  try {
    const { cars } = await readCars();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ cars })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
