import { create } from 'zustand';
import api from '../api/client';

interface User {
  id: string;
  username: string;
  avatar?: string;
  accountType: string;
  accountRole: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  guestLogin: (username?: string) => Promise<void>;
  logout: () => void;
  initAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    set({ user, token });
  },
  guestLogin: async (username) => {
    try {
      const response = await api.post('/auth/guest', { username });
      const { user, access_token } = response.data;
      localStorage.setItem('token', access_token);
      set({ user, token: access_token });
    } catch (error) {
      console.error('Guest login failed:', error);
      throw error;
    }
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
  initAuth: () => {
    const token = localStorage.getItem('token');
    if (token) {
      // In a real app, we might want to fetch the user info with the token
      set({ token });
    }
  },
}));
