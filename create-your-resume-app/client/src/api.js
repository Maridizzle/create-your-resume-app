const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no body, that's fine for some responses
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

export const api = {
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  verify2fa: (token) =>
    request('/auth/verify-2fa', { method: 'POST', body: JSON.stringify({ token }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  listClients: () => request('/clients'),
  createClient: (payload) => request('/clients', { method: 'POST', body: JSON.stringify(payload) }),
  getClient: (id) => request(`/clients/${id}`),
  setStage: (id, stage) => request(`/clients/${id}/stage`, { method: 'POST', body: JSON.stringify({ stage }) })
};
