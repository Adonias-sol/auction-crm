export const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:8000";

export function apiCall(endpoint, options = {}) {
  const token = sessionStorage.getItem('authToken');
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Token ${token}`;
  }

  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
}