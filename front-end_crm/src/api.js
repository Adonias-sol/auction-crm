export const API_BASE = process.env.VITE_API_BASE || 'http://localhost:8000';

export function apiCall(endpoint, options = {}) {
  const token = sessionStorage.getItem('authToken');
  const headers = {
    'Content-Type': 'application/json',
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