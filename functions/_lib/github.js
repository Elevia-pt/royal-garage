// Helpers para ler/escrever src/_data/cars.json via GitHub Contents API.
// Quando escrevemos, o commit no GitHub dispara o webhook do Cloudflare Pages
// que reconstrói o site em ~1 min com os novos dados.
// Web Standard: usa TextEncoder/TextDecoder + btoa/atob em vez de Buffer.

const FILE_PATH = "src/_data/cars.json";

function getConfig(env) {
  const owner = env.GITHUB_OWNER || "Elevia-pt";
  const repo = env.GITHUB_REPO || "royal-garage";
  const branch = env.GITHUB_BRANCH || "main";
  const token = env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN não está configurado nas Environment variables.");
  }
  return {
    api: `https://api.github.com/repos/${owner}/${repo}`,
    branch,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "royal-garage-admin"
    }
  };
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const clean = b64.replace(/\s+/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export async function readCars(env) {
  const { api, branch, headers } = getConfig(env);
  const url = `${api}/contents/${FILE_PATH}?ref=${branch}&t=${Date.now()}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Falha a ler cars.json no GitHub (${res.status}): ${txt}`);
  }
  const data = await res.json();
  const content = base64ToUtf8(data.content);
  return { cars: JSON.parse(content), sha: data.sha };
}

export async function writeCars(cars, sha, message, env) {
  const { api, branch, headers } = getConfig(env);
  const url = `${api}/contents/${FILE_PATH}`;
  const body = {
    message: message || "admin: atualizar cars.json",
    content: utf8ToBase64(JSON.stringify(cars, null, 2)),
    sha,
    branch
  };
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Falha a escrever cars.json no GitHub (${res.status}): ${txt}`);
  }
  return res.json();
}
