const BASE_URL = 'http://localhost:3001/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const get  = (path)         => request(path);
export const post = (path, body)   => request(path, { method: 'POST',   body: JSON.stringify(body) });
export const put  = (path, body)   => request(path, { method: 'PUT',    body: JSON.stringify(body) });
export const del  = (path)         => request(path, { method: 'DELETE' });
