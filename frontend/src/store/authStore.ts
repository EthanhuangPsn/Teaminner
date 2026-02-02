import { create } from 'zustand';
import api from '../api/client';
import { message } from 'antd';

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
  isInitializing: boolean;
  setAuth: (user: User, token: string) => void;
  guestLogin: (username?: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  initAuth: () => Promise<void>;
}

// 回归主流：使用 localStorage，确保整个浏览器共享同一个设备标识
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
  isInitializing: false,
  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    set({ user, token });
  },
  guestLogin: async (username) => {
    const response = await api.post('/auth/guest', { username }, {
      headers: { 'x-device-fingerprint': getFingerprint() }
    });
    const { user, access_token } = response.data;
    localStorage.setItem('token', access_token);
    set({ user, token: access_token, initialized: true });
  },
  register: async (username, password) => {
    const response = await api.post('/auth/register', { username, password });
    const { user, access_token } = response.data;
    localStorage.setItem('token', access_token);
    set({ user, token: access_token, initialized: true });
  },
  login: async (username, password) => {
    const response = await api.post('/auth/login', { username, password }, {
      headers: { 'x-device-fingerprint': getFingerprint() }
    });
    const { user, access_token } = response.data;
    localStorage.setItem('token', access_token);
    set({ user, token: access_token, initialized: true });
  },
  logout: () => {
    localStorage.removeItem('token');
    // 注意：退出时不一定要删除指纹，保留指纹可以让下次“自动登录”找回最后一次使用的账号
    set({ user: null, token: null, initialized: true });
  },
  initAuth: async () => {
    if (get().initialized || get().isInitializing) return;
    set({ isInitializing: true });

    const token = localStorage.getItem('token');
    const fingerprint = getFingerprint();

    try {
      if (token) {
        const response = await api.post('/auth/profile');
        if (response.data && response.data.user) {
          set({ user: response.data.user, token, initialized: true, isInitializing: false });
          return;
        }
      }

      // 尝试 IP+设备 自动登录
      const response = await api.post('/auth/auto-login', {}, {
        headers: { 'x-device-fingerprint': fingerprint }
      });
      
      if (response.data && response.data.user) {
        const { user, access_token } = response.data;
        localStorage.setItem('token', access_token);
        set({ user, token: access_token, initialized: true, isInitializing: false });
        message.info(`自动登录: ${user.username}`);
      }
    } catch (e) {
      localStorage.removeItem('token');
    } finally {
      set({ initialized: true, isInitializing: false });
    }
  },
}));
