export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SESSION_STORAGE_KEY = 'murmur_session';

export function saveSessionToken(token) {
  localStorage.setItem(SESSION_STORAGE_KEY, token);
}

export function clearSessionToken() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = localStorage.getItem(SESSION_STORAGE_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  return fetch(url, { ...options, headers });
}
