import { create } from 'zustand';
import Cookies from 'js-cookie';
import { authAPI } from '@/lib/api';

interface User {
    id: string;
    email: string;
    role: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string) => Promise<void>;
    logout: () => void;
    checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: null, // Initialize as null to avoid hydration mismatch
    isLoading: true,
    isAuthenticated: false,

    login: async (email: string, password: string) => {
        const response = await authAPI.login(email, password);
        const { token, user } = response.data;

        Cookies.set('token', token, { expires: 7 });
        set({ user, token, isAuthenticated: true });
    },

    register: async (email: string, password: string) => {
        const response = await authAPI.register(email, password);
        const { token, user } = response.data;

        Cookies.set('token', token, { expires: 7 });
        set({ user, token, isAuthenticated: true });
    },

    logout: () => {
        Cookies.remove('token');
        set({ user: null, token: null, isAuthenticated: false });
    },

    checkAuth: async () => {
        const token = Cookies.get('token');
        if (!token) {
            set({ isLoading: false, isAuthenticated: false });
            return;
        }

        try {
            const response = await authAPI.getMe();
            set({
                user: response.data.user,
                isAuthenticated: true,
                isLoading: false
            });
        } catch {
            Cookies.remove('token');
            set({
                user: null,
                token: null,
                isAuthenticated: false,
                isLoading: false
            });
        }
    },
}));
