// Shared types, constants and utilities for iChange platform

// User roles
export const ROLES = {
  STUDENT: 'student',
  ADMIN: 'admin',
};

// Socket events (client → server)
export const SOCKET_EVENTS = {
  // Session
  SESSION_JOIN: 'session:join',
  SESSION_LEAVE: 'session:leave',
  SESSION_PARTICIPANTS: 'session:participants',

  // Chat
  CHAT_SEND: 'chat:send',
  CHAT_TYPING: 'chat:typing',
  CHAT_MESSAGE: 'chat:message',
  CHAT_HISTORY: 'chat:history',

  // Hand raise
  HAND_RAISE: 'hand:raise',
  HAND_UPDATE: 'hand:update',

  // Media (Mediasoup signaling)
  MEDIA_GET_RTP_CAPABILITIES: 'media:getRtpCapabilities',
  MEDIA_CREATE_TRANSPORT: 'media:createTransport',
  MEDIA_CONNECT_TRANSPORT: 'media:connectTransport',
  MEDIA_PRODUCE: 'media:produce',
  MEDIA_CONSUME: 'media:consume',
  MEDIA_RESUME_CONSUMER: 'media:resumeConsumer',
  MEDIA_NEW_PRODUCER: 'media:newProducer',
  MEDIA_PRODUCER_CLOSED: 'media:producerClosed',

  // Admin control
  ADMIN_MUTE_ALL: 'admin:muteAll',
  ADMIN_REMOVE_USER: 'admin:removeUser',

  // Errors
  ERROR: 'error',
};

// API base URL helper (resolved at runtime)
export const API_ROUTES = {
  AUTH: {
    REGISTER: '/api/auth/register',
    LOGIN: '/api/auth/login',
    REFRESH: '/api/auth/refresh',
    LOGOUT: '/api/auth/logout',
  },
  SESSIONS: {
    LIST: '/api/sessions',
    CREATE: '/api/sessions',
    GET: (id) => `/api/sessions/${id}`,
    EDIT: (id) => `/api/sessions/${id}`,
    DELETE: (id) => `/api/sessions/${id}`,
    JOIN_BY_CODE: (code) => `/api/sessions/join/${code}`,
  },
  ATTENDANCE: {
    REPORT: (sessionId) => `/api/attendance/${sessionId}`,
  },
};

// Validation constants
export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_MIN_LENGTH: 8,
  NAME_MAX_LENGTH: 100,
  LINK_CODE_LENGTH: 10,
  CHAT_MAX_LENGTH: 1000,
};
