import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore.js';
import { useSessionStore } from '../store/sessionStore.js';

class SocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  connect() {
    if (this.socket?.connected) return this.socket;

    const stored = localStorage.getItem('ichange-auth');
    const token = stored ? JSON.parse(stored)?.state?.accessToken : null;
    this.socket = io(import.meta.env.VITE_API_URL || '', {
      auth: { token },
      withCredentials: true, // Send session cookie
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('🔌 Socket connected:', this.socket.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('connect_error', async (err) => {
      console.warn('⚠️ Socket connection error:', err.message);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔴 Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // server kicked us, probably auth failed permanently
        this.socket.connect();
      }
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      this.reconnectAttempts = attempt;
      console.log(`🔄 Reconnect attempt ${attempt}`);
    });

    this.socket.on('reconnect', () => {
      console.log('✅ Socket reconnected');
    });

    // ── Global Profile Sync ──
    this.socket.on('user:profile_updated', ({ userId, avatar, source }) => {
      // 1. Update current authenticated user if matches
      const { user, updateUser } = useAuthStore.getState();
      if (user && user._id === userId) {
        updateUser({ avatar, image_source: source });
      }

      // 2. Update participant list in active sessions
      const { updateParticipantProfile, participants } = useSessionStore.getState();
      const isParticipant = participants.some(p => p.userId === userId);
      if (isParticipant) {
        updateParticipantProfile(userId, avatar);
      }
    });

    this.socket.on('reconnect_failed', () => {
      console.error('❌ Socket reconnection failed after max attempts');
    });

    return this.socket;
  }

  disconnect() {
    if (this._unsub) {
      this._unsub();
      this._unsub = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket;
  }

  emit(event, data) {
    this.socket?.emit(event, data);
  }

  on(event, handler) {
    this.socket?.on(event, handler);
  }

  off(event, handler) {
    this.socket?.off(event, handler);
  }
}

export const socketService = new SocketService();
