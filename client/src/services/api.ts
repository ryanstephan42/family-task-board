import axios from 'axios';

const SERVER_ORIGIN = import.meta.env.PROD ? '' : 'http://localhost:5000';

const api = axios.create({
  baseURL: `${SERVER_ORIGIN}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Uploaded photos are served from /uploads (outside /api), so resolve
// their full URL relative to the server origin, not the API base.
export const resolveUploadUrl = (photoUrl: string | null | undefined) =>
  photoUrl ? `${SERVER_ORIGIN}${photoUrl}` : null;

export default api;