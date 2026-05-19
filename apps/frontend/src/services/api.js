import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? (import.meta.env.VITE_API_URL.endsWith('/') ? import.meta.env.VITE_API_URL.slice(0, -1) : import.meta.env.VITE_API_URL) : 'https://api.ichangehub.me',
  timeout: 15000,
  withCredentials: true,
});

// Authentication is now handled via secure session cookies automatically by the browser.
// The baseURL is managed through environment variables.

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
