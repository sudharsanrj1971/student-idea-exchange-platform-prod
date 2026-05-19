import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';

const BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const { logout } = useAuthStore.getState();
      
      // Prevent infinite loops if status check itself fails
      if (!error.config.url?.includes('/api/auth/status')) {
        console.warn('[API] Unauthorized access - logging out');
        logout();
      }
    }
    return Promise.reject(error);
  }
);


export default api;
