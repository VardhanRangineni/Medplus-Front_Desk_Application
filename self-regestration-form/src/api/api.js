const DEFAULT_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:9090';
//const DEFAULT_BASE = import.meta.env.VITE_API_BASE || 'https://tapping-overhang-gigabyte.ngrok-free.dev/';


export function getApiBase() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('api');
  const base = (fromQuery || DEFAULT_BASE).replace(/\/$/, '');
  return base;
}

async function parseJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiRequest(method, path, body) {
  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: body != null ? { 'Content-Type': 'application/json' } : undefined,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const json = await parseJson(res);
  if (!json) {
    throw new Error('Unexpected response from server.');
  }
  return json;
}
