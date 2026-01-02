import axios from 'axios';
import Cookies from 'js-cookie';

// Use relative URLs if NEXT_PUBLIC_API_URL is not set (same-origin deployment)
// Otherwise use the provided URL (remove trailing slash to prevent double-slash URLs)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')
    : '';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const token = Cookies.get('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            Cookies.remove('token');
            if (typeof window !== 'undefined') {
                window.location.href = '/app/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;

// Auth API
export const authAPI = {
    login: (email: string, password: string) =>
        api.post('/api/auth/login', { email, password }),
    register: (email: string, password: string) =>
        api.post('/api/auth/register', { email, password }),
    getMe: () => api.get('/api/auth/me'),
};

// Folders API
export const foldersAPI = {
    getAll: () => api.get('/api/folders'),
    getById: (id: string) => api.get(`/api/folders/${id}`),
    getSubfolders: (id: string) => api.get(`/api/folders/${id}/subfolders`),
    getStats: () => api.get('/api/folders/stats/summary'),
    create: (name: string, parentId?: string) =>
        api.post('/api/folders', { name, parentId }),
    rename: (id: string, name: string) =>
        api.put(`/api/folders/${id}`, { name }),
    delete: (id: string) => api.delete(`/api/folders/${id}`),
    share: (id: string) => api.post(`/api/folders/${id}/share`),
    unshare: (id: string) => api.delete(`/api/folders/${id}/share`),
};

// Files API
export const filesAPI = {
    getByFolder: (folderId: string) => api.get(`/api/files/folder/${folderId}`),
    upload: (folderId: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folderId', folderId);
        return api.post('/api/files', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    rename: (id: string, name: string) =>
        api.put(`/api/files/${id}`, { name }),
    delete: (id: string) => api.delete(`/api/files/${id}`),
    share: (id: string) => api.post(`/api/files/${id}/share`),
    unshare: (id: string) => api.delete(`/api/files/${id}/share`),
};

// Public API
export const publicAPI = {
    getShared: (shareId: string) => api.get(`/api/public/${shareId}`),
    getSubfolder: (shareId: string, folderId: string) => api.get(`/api/public/${shareId}/folder/${folderId}`),
};
