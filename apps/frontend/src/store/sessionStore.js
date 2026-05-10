import { create } from 'zustand';

export const useSessionStore = create((set, get) => ({
  sessions: [],
  currentSession: null,
  participants: [],
  raisedHands: new Set(),
  isLoading: false,
  error: null,

  setSessions: (sessions) => set({ sessions }),
  setCurrentSession: (session) => set({ currentSession: session }),

  setParticipants: (participants) => set({ participants }),

  addParticipant: (participant) =>
    set((state) => ({
      participants: [...state.participants.filter((p) => p.userId !== participant.userId), participant],
    })),

  removeParticipant: (userId) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.userId.toString() !== userId.toString()),
    })),

  updateParticipantProfile: (userId, avatar) =>
    set((state) => ({
      participants: state.participants.map((p) => 
        p.userId.toString() === userId.toString() ? { ...p, avatar } : p
      ),
    })),

  toggleHand: (userId, raised) =>
    set((state) => {
      const hands = new Set(state.raisedHands);
      const idStr = userId?.toString();
      if (idStr) {
        raised ? hands.add(idStr) : hands.delete(idStr);
      }
      return { raisedHands: hands };
    }),

  lowerHand: (userId) =>
    set((state) => {
      const hands = new Set(state.raisedHands);
      hands.delete(userId?.toString());
      return { raisedHands: hands };
    }),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  reset: () => set({ currentSession: null, participants: [], raisedHands: new Set() }),
}));
