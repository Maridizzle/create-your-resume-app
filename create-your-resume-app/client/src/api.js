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

// Streams a chat reply. chat.js's endpoint is SSE over POST, so the native
// EventSource (GET-only, no custom credentials) can't be used here.
async function* streamChatMessage(clientId, message) {
  const res = await fetch(`${BASE}/chat/${clientId}/message`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  if (!res.ok) throw new Error(`Chat request failed (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      if (payload === '[DONE]') return;
      const { text, error } = JSON.parse(payload);
      if (error) throw new Error(error);
      if (text) yield text;
    }
  }
}

async function extractResume(files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const res = await fetch(`${BASE}/clients/extract-resume`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function fetchBlob(path) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', credentials: 'include' });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {
      // no JSON body
    }
    throw new Error(message);
  }
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="(.+)"/);
  return { blob: await res.blob(), filename: match ? match[1] : 'intake.docx' };
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
  setStage: (id, stage) => request(`/clients/${id}/stage`, { method: 'POST', body: JSON.stringify({ stage }) }),
  extractResume,
  suggestRole: (resumeText) =>
    request('/clients/suggest-role', { method: 'POST', body: JSON.stringify({ resumeText }) }),

  getChatHistory: (clientId) => request(`/chat/${clientId}/history`),
  streamChatMessage,

  getChecklist: (clientId) => request(`/intake/${clientId}/checklist`, { method: 'POST' }),
  generateIntake: (clientId, jsonData) =>
    request(`/intake/${clientId}/generate`, { method: 'POST', body: JSON.stringify({ jsonData }) }),
  generateLink: (clientId) => request(`/intake/${clientId}/link`, { method: 'POST' }),
  getIntake: (clientId) => request(`/intake/${clientId}`),

  refreshResults: (clientId) => request(`/results/${clientId}/refresh`, { method: 'POST' }),
  getResults: (clientId) => request(`/results/${clientId}`),

  generateOutput: (clientId) => fetchBlob(`/output/${clientId}/generate`)
};
