import axios from 'axios';
import Cookies from 'js-cookie';
import { getApiUrl } from './config';

// Create axios instance - baseURL is set dynamically on each request
const api = axios.create({
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token AND dynamic base URL
api.interceptors.request.use(
    (config) => {
        // Set base URL dynamically (reads from runtime config)
        config.baseURL = getApiUrl();

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

    // Trash operations
    getTrash: () => api.get('/api/folders/trash/list'),
    restore: (id: string) => api.post(`/api/folders/${id}/restore`),
    permanentDelete: (id: string) => api.delete(`/api/folders/${id}/permanent`),
    emptyTrash: () => api.post('/api/folders/trash/empty'),
};

// Files API
export const filesAPI = {
    getByFolder: (folderId: string) => api.get(`/api/files/folder/${folderId}`),
    upload: (folderId: string, files: File[], onProgress?: (progress: number) => void) => {
        const formData = new FormData();
        files.forEach(file => formData.append('files', file));
        formData.append('folderId', folderId);

        return api.post('/api/files', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    );
                    onProgress(percentCompleted);
                }
            },
        });
    },
    rename: (id: string, name: string) =>
        api.put(`/api/files/${id}`, { name }),
    delete: (id: string) => api.delete(`/api/files/${id}`),
    share: (id: string) => api.post(`/api/files/${id}/share`),
    unshare: (id: string) => api.delete(`/api/files/${id}/share`),

    // Trash operations
    getTrash: () => api.get('/api/files/trash/list'),
    restore: (id: string) => api.post(`/api/files/${id}/restore`),
    permanentDelete: (id: string) => api.delete(`/api/files/${id}/permanent`),
    emptyTrash: () => api.post('/api/files/trash/empty'),
};

// Public API
export const publicAPI = {
    getShared: (shareId: string) => api.get(`/api/public/${shareId}`),
    getSubfolder: (shareId: string, folderId: string) => api.get(`/api/public/${shareId}/folder/${folderId}`),
};

// Search API
export const searchAPI = {
    search: (query: string, type?: 'files' | 'folders' | 'all') =>
        api.get('/api/search', { params: { q: query, type } }),
};
