import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? (import.meta.env.VITE_API_URL.endsWith('/') ? import.meta.env.VITE_API_URL.slice(0, -1) : import.meta.env.VITE_API_URL) : '',
  timeout: 15000,
  withCredentials: true,
});

// ── Request interceptor: attach access token ──
api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ── Response interceptor: auto-refresh on 401 ──
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    error ? prom.reject(error) : prom.resolve(token);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      // ── Don't try to refresh for logout or refresh requests ──
      if (originalRequest.url?.includes('/api/auth/logout') || originalRequest.url?.includes('/api/auth/refresh')) {
        // If logout itself returns 401, just finish the cleanup
        useAuthStore.getState().logout();
        try { localStorage.removeItem('ichange-auth'); } catch (_) {}
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const { setAuth, user, logout } = useAuthStore.getState();

      try {
        const refreshUrl = `${import.meta.env.VITE_API_URL || ''}/api/auth/refresh`;
        const { data } = await axios.post(refreshUrl, {}, { withCredentials: true });
        setAuth(user, data.accessToken);
        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        // Full cleanup: logout + clear persisted store so next page load is clean
        logout();
        try { localStorage.removeItem('ichange-auth'); } catch (_) {}
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);


export default api;
