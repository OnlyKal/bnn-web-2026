import axios from 'axios';
import { getSession, clearSession } from './utils/auth';

// Base API configuration
const API_BASE_URL = 'http://localhost:8000/api/bnn'; // Adjust this URL as needed

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const { token } = getSession();
        if (token) {
            config.headers.Authorization = `${token}`;
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
        // If unauthorized, clear session and redirect to login
        if (error.response?.status === 401) {
            clearSession();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Authentication API
export const authAPI = {
    // Login user
    login: async (credentials) => {
        try {
            const response = await api.post('/auth/login/', credentials);
            return response.data;
        } catch (error) {
            throw new Error(
                error.response?.data?.detail || 
                error.response?.data?.message || 
                'Erreur de connexion'
            );
        }
    },

    // Register user
    register: async (userData) => {
        try {
            console.log('Sending registration data:', userData);
            const response = await api.post('/user/signup/', userData);
            console.log('Registration response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Registration error details:', error.response?.data);
            console.error('Registration error status:', error.response?.status);
            console.error('Full error:', error);
            
            // Handle different types of validation errors
            if (error.response?.data) {
                const errorData = error.response.data;
                
                // If it's a validation error with field-specific errors
                if (typeof errorData === 'object' && !errorData.message && !errorData.detail) {
                    const fieldErrors = [];
                    Object.keys(errorData).forEach(field => {
                        if (Array.isArray(errorData[field])) {
                            fieldErrors.push(`${field}: ${errorData[field].join(', ')}`);
                        } else {
                            fieldErrors.push(`${field}: ${errorData[field]}`);
                        }
                    });
                    throw new Error(fieldErrors.join('\n'));
                }
                
                // If it's a general error message
                throw new Error(
                    errorData.detail || 
                    errorData.message || 
                    `Erreur ${error.response.status}: ${JSON.stringify(errorData)}`
                );
            }
            
            throw new Error(`Erreur lors de l'inscription (${error.response?.status || 'inconnu'}). Veuillez réessayer.`);
        }
    },

    // Logout user
    logout: async () => {
        try {
            await api.post('/auth/logout/');
        } catch (error) {
            console.warn('Logout error:', error);
        } finally {
            clearSession();
        }
    },

    // Verify token
    verifyToken: async () => {
        try {
            const response = await api.get('/auth/verify/');
            return response.data;
        } catch (error) {
            throw new Error('Token invalide');
        }
    },

    // Refresh token
    refreshToken: async () => {
        try {
            const response = await api.post('/auth/refresh/');
            return response.data;
        } catch (error) {
            throw new Error('Impossible de renouveler le token');
        }
    }
};

// User API
export const userAPI = {
    // Get user profile
    getProfile: async () => {
        try {
            const response = await api.get('/user/profile/');
            return response.data;
        } catch (error) {
            throw new Error(
                error.response?.data?.detail || 
                'Erreur lors du chargement du profil'
            );
        }
    },

    // Update user profile
    updateProfile: async (profileData) => {
        try {
            const response = await api.put('/user/profile/', profileData);
            return response.data;
        } catch (error) {
            throw new Error(
                error.response?.data?.detail || 
                'Erreur lors de la mise à jour du profil'
            );
        }
    },

    // Change password
    changePassword: async (passwordData) => {
        try {
            const response = await api.post('/user/change-password/', passwordData);
            return response.data;
        } catch (error) {
            throw new Error(
                error.response?.data?.detail || 
                'Erreur lors du changement de mot de passe'
            );
        }
    }
};

// Utility functions for form validation
export const validators = {
    validateEmail: (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    validatePhone: (phone) => {
        // Must start with +243 followed by 9 digits
        const re = /^\+243[0-9]{9}$/;
        return re.test(phone.replace(/\s/g, ''));
    },

    validatePassword: (password) => {
        // Must start with 4
        return password.startsWith('4');
    },

    validateUsername: (username) => {
        const re = /^[a-zA-Z0-9_]{3,20}$/;
        return re.test(username);
    },

    validateRequired: (value) => {
        return value && value.toString().trim() !== '';
    }
};

// Export the main API instance
export default api;