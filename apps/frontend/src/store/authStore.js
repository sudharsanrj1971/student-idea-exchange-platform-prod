import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api.js';
import { socketService } from '../services/socket.js';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      _isLoggingOut: false,
      _isChecking: false,

      setAuth: (user) =>
        set({ user }),

      logout: async () => {
        if (get()._isLoggingOut) return;
        set({ _isLoggingOut: true });
        
        try {
          await api.post('/api/auth/logout', {}, { timeout: 3000 });
        } catch (err) {
          console.warn('[Auth] Logout API call failed or timed out:', err.message);
        } finally {
          socketService.disconnect();
          set({ user: null, _isLoggingOut: false });
          try { localStorage.removeItem('ichange-auth'); } catch (_) {}
        }
      },

      checkAuth: async () => {
        if (get()._isChecking) return;
        set({ _isChecking: true });
        try {
          const { data } = await api.get('/api/auth/status');
          if (data.authenticated) {
            set({ user: data.user });
            return data.user;
          }
        } catch (err) {
          // If 401, it's handled by the interceptor which calls logout()
          if (err.response?.status !== 401) {
            console.error('[Auth] checkAuth failed:', err.message);
          }
        } finally {
          set({ _isChecking: false });
        }
        return null;
      },

      updateUser: (updates) =>
        set((state) => {
          const newUser = { ...state.user, ...updates };
          if (updates.profilePic && !updates.avatar) newUser.avatar = updates.profilePic;
          if (updates.avatar && !updates.profilePic) newUser.profilePic = updates.avatar;
          return { user: newUser };
        }),

      refreshProfile: async () => {
        try {
          const { data } = await api.get('/api/user/profile');
          if (data) {
            // Standardizing on 'profilePic' as the primary field for the UI
            const profilePic = data.profile_image || null;
            console.log('[Auth] refreshProfile synced profilePic:', profilePic);
            set((state) => ({ 
              user: { 
                ...state.user, 
                profilePic,
                avatar: profilePic, // Alias for compatibility
                image_source: data.image_source 
              } 
            }));
          }
        } catch (err) {
          if (err.response?.status !== 404) {
            console.error('Failed to refresh profile', err.message);
          }
        }
      },
      
      uploadAvatar: async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        try {
          const { data } = await api.post('/api/user/profile/image', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          set((state) => ({ 
            user: { 
              ...state.user, 
              profilePic: data.profile_image, 
              avatar: data.profile_image, // Alias for compatibility
              image_source: data.image_source 
            } 
          }));
          return data;
        } catch (err) {
          throw err;
        }
      }
    }),
    {
      name: 'ichange-auth',
      partialize: (state) => ({
        user: state.user,
      }),
    }
  )
);
