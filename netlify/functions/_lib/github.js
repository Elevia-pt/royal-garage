// Helpers para ler/escrever src/_data/cars.json via GitHub Contents API.
// Quando escrevemos, o commit no GitHub dispara o webhook do Netlify
// que reconstrói o site em ~1 min com os novos dados.

const REPO_OWNER = process.env.GITHUB_OWNER || "Elevia-pt";
const REPO_NAME = process.env.GITHUB_REPO || "royal-garage";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const FILE_PATH = "src/_data/cars.json";

const API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

function headers() {
  const t = process.env.GITHUB_TOKEN;
  if (!t) {
    throw new Error("GITHUB_TOKEN não está configurado nas Environment variables do Netlify.");
  }
  return {
    Authorization: `Bearer ${t}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "royal-garage-admin"
  };
}

exports.readCars = async function () {
  const url = `${API}/contents/${FILE_PATH}?ref=${BRANCH}&t=${Date.now()}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Falha a ler cars.json no GitHub (${res.status}): ${txt}`);
  }
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf8");
  return { cars: JSON.parse(content), sha: data.sha };
};

exports.writeCars = async function (cars, sha, message) {
  const url = `${API}/contents/${FILE_PATH}`;
  const body = {
    message: message || "admin: atualizar cars.json",
    content: Buffer.from(JSON.stringify(cars, null, 2)).toString("base64"),
    sha,
    branch: BRANCH
  };
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Falha a escrever cars.json no GitHub (${res.status}): ${txt}`);
  }
  return res.json();
};
