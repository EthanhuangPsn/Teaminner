import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import api from '../api/client';
import { useAuthStore } from './authStore';

interface Room {
  id: string;
  roomName: string;
  status: 'preparing' | 'assaulting';
  maxUsers: number;
  currentUserCount?: number;
  _count?: { users: number };
  leaderId: string | null;
  users: any[];
  teams: any[];
}

interface RoomState {
  rooms: Room[];
  currentRoom: Room | null;
  socket: Socket | null;
  fetchRooms: () => Promise<void>;
  fetchRoom: (id: string) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  connectSocket: (token: string) => void;
  disconnectSocket: () => void;
  resetRoom: () => void;
  toggleStatus: (status: 'preparing' | 'assaulting') => Promise<void>;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  rooms: [],
  currentRoom: null,
  socket: null,

  fetchRooms: async () => {
    try {
      const response = await api.get('/rooms');
      set({ rooms: response.data });
    } catch (error) {
      console.error('Fetch rooms failed:', error);
    }
  },

  fetchRoom: async (id) => {
    try {
      const response = await api.get(`/rooms/${id}`);
      set({ currentRoom: response.data });
    } catch (error) {
      console.error('Fetch room failed:', error);
    }
  },

  joinRoom: async (roomId) => {
    try {
      const response = await api.post(`/rooms/${roomId}/join`);
      set({ currentRoom: response.data });
      
      const { user } = useAuthStore.getState();
      if (user) {
        get().socket?.emit('subscribe-room', { roomId, userId: user.id });
      }
    } catch (error) {
      console.error('Join room failed:', error);
      throw error;
    }
  },

  leaveRoom: async () => {
    const { currentRoom, socket } = get();
    if (!currentRoom) return;

    try {
      await api.post('/rooms/leave');
      socket?.emit('unsubscribe-room', currentRoom.id);
    } catch (error) {
      console.error('Leave room failed:', error);
    } finally {
      set({ currentRoom: null });
    }
  },

  resetRoom: () => {
    const { socket } = get();
    socket?.disconnect();
    set({ currentRoom: null, socket: null });
  },

  connectSocket: (token) => {
    const socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000', {
      auth: { token },
    });

    socket.on('room-updated', (room) => {
      const { currentRoom } = get();
      if (currentRoom && currentRoom.id === room.id) {
        set({ currentRoom: room });
      }
    });

    socket.on('room-state-changed', () => {
      const { currentRoom } = get();
      if (currentRoom) {
        // Refresh room data
        api.get(`/rooms/${currentRoom.id}`).then(res => {
            set({ currentRoom: res.data });
        });
      }
    });

    set({ socket });
  },

  disconnectSocket: () => {
    get().socket?.disconnect();
    set({ socket: null });
  },

  toggleStatus: async (status) => {
    const { currentRoom } = get();
    if (!currentRoom) return;

    try {
      await api.patch(`/rooms/${currentRoom.id}/status`, { status });
    } catch (error) {
      console.error('Toggle status failed:', error);
    }
  },
}));
