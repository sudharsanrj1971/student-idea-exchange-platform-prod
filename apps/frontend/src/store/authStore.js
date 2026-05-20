import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api.js';
import { socketService } from '../services/socket.js';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      _isChecking: true,
      _isLoggingOut: false,

      setAuth: (user, token) => {
        set({ user, accessToken: token, _isChecking: false });
      },

      checkAuth: async () => {
        const token = get().accessToken;
        if (!token) {
          set({ user: null, _isChecking: false });
          return null;
        }
        try {
          const { data } = await api.get('/api/auth/status');
          if (data?.user) {
            set({ user: data.user, accessToken: token, _isChecking: false });
            return data.user;
          } else {
            set({ user: null, accessToken: null, _isChecking: false });
            return null;
          }
        } catch (err) {
          set({ user: null, accessToken: null, _isChecking: false });
          return null;
        }
      },

      logout: async () => {
        if (get()._isLoggingOut) return;
        set({ _isLoggingOut: true });
        try {
          await api.post('/api/auth/logout', {}, { timeout: 3000 });
        } catch (_) {}
        finally {
          socketService.disconnect();
          set({ user: null, accessToken: null, _isChecking: false, _isLoggingOut: false });
          try { localStorage.removeItem('ichange-auth'); } catch (_) {}
        }
      },

      updateUser: (updates) =>
        set((state) => ({
          user: { ...state.user, ...updates }
        })),

      refreshProfile: async () => {
        try {
          const { data } = await api.get('/api/user/profile');
          if (data) {
            const profilePic = data.profile_image || data.profilePic || null;
            set((state) => ({
              user: { ...state.user, profilePic, avatar: profilePic }
            }));
          }
        } catch (_) {}
      },

      uploadAvatar: async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        const { data } = await api.post('/api/user/profile/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        set((state) => ({
          user: { ...state.user, profilePic: data.profile_image, avatar: data.profile_image }
        }));
        return data;
      }
    }),
    {
      name: 'ichange-auth',
      onRehydrateStorage: () => (state) => {
        if (state) state._isChecking = false;
      },
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
    }
  )
);
