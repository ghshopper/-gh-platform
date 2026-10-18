import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

export const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('data:')) {
    if (path.includes('127.0.0.1:8000') || path.includes('localhost:8000')) {
      return path.replace(/http:\/\/(127\.0\.0\.1:8000|localhost:8000)/, 'https://ghshopper.com');
    }
    return path;
  }
  // Force ghshopper.com base url for any relative storage paths to ensure they load on production
  const baseUrl = 'https://ghshopper.com';
  return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
};

