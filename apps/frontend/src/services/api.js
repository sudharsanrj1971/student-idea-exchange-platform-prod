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
    const token = useAuthStore.getState().accessToken;
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
    const originalRequest = error.config;
    
    // Define endpoints that should never trigger a token refresh on 401
    const skipRefreshUrls = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/refresh',
      '/api/auth/logout',
      '/api/auth/google'
    ];
    const shouldSkipRefresh = skipRefreshUrls.some(url => originalRequest.url?.includes(url));

    if (error.response?.status === 401 && !originalRequest._retry && !shouldSkipRefresh) {
      originalRequest._retry = true;
      try {
        const refreshResponse = await axios.post(
          `${BASE_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const { accessToken } = refreshResponse.data;
        
        // Update the Zustand store so all subsequent requests use the new token
        useAuthStore.setState({ accessToken });
        
        // Update authorization header for the retried request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Clear auth store state completely on refresh failure to force re-login
        useAuthStore.setState({ user: null, accessToken: null, _isChecking: false });
        try {
          localStorage.removeItem('ichange-auth');
        } catch (_) {}
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
