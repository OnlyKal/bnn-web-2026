import axios from 'axios';
import { getAuthHeader, logout } from '../utils/auth';
import { API_BASE_URL } from '../config';

// Base URL for API
// API_BASE_URL is now imported from config.js

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const authHeaders = getAuthHeader();
        config.headers = { ...config.headers, ...authHeaders };
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle token expiration
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            logout();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// API functions
export const authAPI = {
    // Login
    login: async (credentials) => {
        const response = await axios.post(`${API_BASE_URL}/user/signin/`, credentials);
        return response.data;
    },

    // Register (if you have registration endpoint)
    register: async (userData) => {
        const response = await axios.post(`${API_BASE_URL}/user/signup/`, userData);
        return response.data;
    },

    // Reset password (if you have this endpoint)
    resetPassword: async (email) => {
        const response = await axios.post(`${API_BASE_URL}/user/reset-password/`, { email });
        return response.data;
    }
};

export const userAPI = {
    // Get user profile
    getProfile: async () => {
        const response = await api.get('/user/profile/');
        return response.data;
    },

    // Update user profile
    updateProfile: async (profileData) => {
        const response = await api.put('/user/profile/', profileData);
        return response.data;
    },

    // Upload avatar
    uploadAvatar: async (formData) => {
        const response = await api.post('/user/avatar/', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    }
};

// Example: Add more API endpoints as needed
export const dataAPI = {
    // Get some protected data
    getData: async () => {
        const response = await api.get('/data/');
        return response.data;
    },

    // Create data
    createData: async (data) => {
        const response = await api.post('/data/', data);
        return response.data;
    },

    // Update data
    updateData: async (id, data) => {
        const response = await api.put(`/data/${id}/`, data);
        return response.data;
    },

    // Delete data
    deleteData: async (id) => {
        const response = await api.delete(`/data/${id}/`);
        return response.data;
    }
};

export default api;