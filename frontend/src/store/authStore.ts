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
  initialized: boolean;
  setAuth: (user: User, token: string) => void;
  guestLogin: (username?: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  initAuth: () => Promise<void>;
}

// Simple device fingerprint using localStorage
const getFingerprint = () => {
  let fp = localStorage.getItem('device_fingerprint');
  if (!fp) {
    fp = crypto.randomUUID();
    localStorage.setItem('device_fingerprint', fp);
  }
  return fp;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  initialized: false,
  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    set({ user, token });
  },
  guestLogin: async (username) => {
    try {
      const response = await api.post('/auth/guest', { username }, {
        headers: { 'x-device-fingerprint': getFingerprint() }
      });
      const { user, access_token } = response.data;
      localStorage.setItem('token', access_token);
      set({ user, token: access_token });
    } catch (error) {
      console.error('Guest login failed:', error);
      throw error;
    }
  },
  register: async (username, password) => {
    try {
      const response = await api.post('/auth/register', { username, password });
      const { user, access_token } = response.data;
      localStorage.setItem('token', access_token);
      set({ user, token: access_token });
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  },
  login: async (username, password) => {
    try {
      const response = await api.post('/auth/login', { username, password }, {
        headers: { 'x-device-fingerprint': getFingerprint() }
      });
      const { user, access_token } = response.data;
      localStorage.setItem('token', access_token);
      set({ user, token: access_token });
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
  initAuth: async () => {
    if (get().initialized) return;

    const token = localStorage.getItem('token');
    const fingerprint = getFingerprint();

    if (token) {
      // 1. 如果本地有 Token，去后端换取最新的用户信息
      try {
        const response = await api.post('/auth/profile');
        if (response.data && response.data.user) {
          set({ user: response.data.user, token, initialized: true });
          return;
        }
      } catch (e) {
        console.warn('Token expired or invalid, cleaning up...');
        localStorage.removeItem('token');
      }
    }

    // 2. 如果本地没 Token，或者 Token 已失效，尝试 IP 自动登录
    try {
      const response = await api.post('/auth/auto-login', {}, {
        headers: { 'x-device-fingerprint': fingerprint }
      });
      if (response.data && response.data.user) {
        const { user, access_token } = response.data;
        localStorage.setItem('token', access_token);
        set({ user, token: access_token, initialized: true });
      } else {
        set({ initialized: true });
      }
    } catch (error) {
      set({ initialized: true });
    }
  },
}));
