import axios from 'axios';
import { getSession, clearSession, saveSession } from './utils/auth';
import { API_BASE_URL } from './config';

// Base API configuration
// API_BASE_URL is now imported from config.js

const avatarApi = axios.create({
    baseURL: API_BASE_URL, // Use same base URL
    timeout: 30000, // Longer timeout for file uploads
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth interceptor for avatar API
avatarApi.interceptors.request.use(
    (config) => {
        const { token } = getSession();
        if (token) {
            // Use the token as-is if it already has Bearer/Token prefix, otherwise add Bearer
            const authToken = token.startsWith('Bearer ') || token.startsWith('Token ') ? token : `Bearer ${token}`;
            config.headers.Authorization = authToken;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // Increased from 10s to 30s for heavy API calls like /ressource/all/
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const { token } = getSession();
        if (token) {
            // Use the token as-is if it already has Bearer/Token prefix, otherwise add Bearer
            const authToken = token.startsWith('Bearer ') || token.startsWith('Token ') ? token : `Bearer ${token}`;
            config.headers.Authorization = authToken;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling and automatic token refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    
    isRefreshing = false;
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        
        // If unauthorized and not already retrying
        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                // Queue the request
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                }).catch(err => Promise.reject(err));
            }
            
            originalRequest._retry = true;
            isRefreshing = true;
            
            try {
                // console.log('🔄 Attempting to refresh token...');
                const response = await api.post('/auth/refresh/');
                const newToken = response.data.token || response.data;
                
                // Get current user data
                const { userData } = getSession();
                
                // Save new token
                saveSession(newToken, userData);
                
                // console.log('✅ Token refreshed successfully');
                
                // Update original request with new token
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                
                // Process queued requests
                processQueue(null, newToken);
                
                // Retry original request
                return api(originalRequest);
            } catch (refreshError) {
                console.error('❌ Token refresh failed:', refreshError);
                
                // Clear session and redirect to login
                clearSession();
                processQueue(refreshError, null);
                window.location.href = '/login';
                
                return Promise.reject(refreshError);
            }
        }
        
        return Promise.reject(error);
    }
);

const errorFieldLabels = {
    username: "Nom d'utilisateur",
    nom: 'Nom',
    prenom: 'Prénom',
    password: 'Mot de passe',
    email: 'Email',
    telephone: 'Téléphone',
    sexe: 'Sexe',
    date_naissance: 'Date de naissance',
    faculte: 'Faculté',
    universite: 'Université',
    role: "Type d'utilisateur",
    non_field_errors: 'Erreur',
    detail: 'Erreur',
    message: 'Erreur',
    error: 'Erreur',
    errors: 'Erreur'
};

const technicalErrorFields = new Set(['status', 'status_code', 'code']);

const humanizeApiErrorMessage = (message, field = '') => {
    const normalizedMessage = message.toLowerCase();

    if (
        field === 'email' &&
        normalizedMessage.includes('utilisateur') &&
        normalizedMessage.includes('email') &&
        normalizedMessage.includes('existe')
    ) {
        return 'Cette adresse email est déjà utilisée. Veuillez utiliser une autre adresse ou vous connecter.';
    }

    if (
        field === 'username' &&
        normalizedMessage.includes('utilisateur') &&
        normalizedMessage.includes('username') &&
        normalizedMessage.includes('existe')
    ) {
        return "Ce nom d'utilisateur est déjà utilisé. Veuillez en choisir un autre.";
    }

    return message;
};

const formatApiErrorValue = (value, field = '') => {
    if (!value) return '';

    if (Array.isArray(value)) {
        return value
            .map(item => formatApiErrorValue(item, field))
            .filter(Boolean)
            .join('\n');
    }

    if (typeof value === 'object') {
        return Object.entries(value)
            .filter(([key]) => !technicalErrorFields.has(key))
            .map(([key, nestedValue]) => formatApiErrorValue(nestedValue, key))
            .filter(Boolean)
            .join('\n');
    }

    const message = humanizeApiErrorMessage(String(value), field);
    if (!field || ['detail', 'message', 'error', 'errors', 'non_field_errors'].includes(field)) {
        return message;
    }

    const label = errorFieldLabels[field] || field;
    return `${label}: ${message}`;
};

const getApiErrorMessage = (error, fallbackMessage = 'Une erreur est survenue') => {
    const errorData = error.response?.data;

    if (errorData) {
        if (typeof errorData === 'string') {
            return errorData;
        }

        const formattedMessage = formatApiErrorValue(errorData);
        if (formattedMessage) {
            return formattedMessage;
        }
    }

    return error.message || fallbackMessage;
};

// Authentication API
export const authAPI = {
    // Login user
    login: async (credentials) => {
        try {
            const response = await api.post('/user/signin/', credentials);
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
            // console.log('Sending registration data:', userData);
            const response = await api.post('/user/signup/', userData);
            // console.log('Registration response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Registration error details:', error.response?.data);
            console.error('Registration error status:', error.response?.status);
            console.error('Full error:', error);

            throw new Error(getApiErrorMessage(
                error,
                `Erreur lors de l'inscription (${error.response?.status || 'inconnu'}). Veuillez réessayer.`
            ));
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
    },

    // Reset password
    resetPassword: async (emailData) => {
        try {
            // console.log('🔄 API resetPassword - Making request to:', '/user/password-reset/');
            // console.log('📧 API resetPassword - Request data:', emailData);
            // console.log('🌐 API resetPassword - Base URL:', API_BASE_URL);
            
            // Validate email format
            if (!emailData.email || !emailData.email.includes('@')) {
                throw new Error('Adresse email invalide');
            }
            
            // Create a separate axios instance WITHOUT authentication for password reset
            const unauthenticatedApi = axios.create({
                baseURL: API_BASE_URL,
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            // Make PUT request WITHOUT authentication
            const response = await unauthenticatedApi.put('/user/password-reset/', emailData);
            
            // console.log('✅ API resetPassword - Response:', response.data);
            // console.log('🏷️  API resetPassword - Status:', response.status);
            
            // Return the response with success flag
            return {
                ...response.data,
                status: response.status,
                success: true
            };
        } catch (error) {
            console.error('❌ API resetPassword - Error details:');
            console.error('   - Status:', error.response?.status);
            console.error('   - Status Text:', error.response?.statusText);
            console.error('   - Data:', error.response?.data);
            console.error('   - Config URL:', error.config?.url);
            console.error('   - Config Method:', error.config?.method);
            console.error('   - Full Error:', error.message);
            
            // Handle specific error cases
            if (error.response?.status === 401) {
                throw new Error('Vous devez être connecté pour effectuer cette action. Veuillez vous connecter et réessayer.');
            }
            
            if (error.response?.status === 404) {
                throw new Error('Service de réinitialisation de mot de passe non disponible.');
            }
            
            if (error.response?.status >= 500) {
                throw new Error('Erreur serveur. Veuillez réessayer plus tard.');
            }
            
            // Extract error message from response
            const errorMessage = error.response?.data?.detail || 
                               error.response?.data?.message || 
                               error.response?.data?.error ||
                               error.message ||
                               'Erreur lors de la réinitialisation du mot de passe';
            
            throw new Error(errorMessage);
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
            // Debug: Check what token is being sent
            const { token } = getSession();
            // console.log('API updateProfile - Token available:', !!token);
            if (token) {
                // console.log('API updateProfile - Token format:', token.startsWith('Bearer ') || token.startsWith('Token ') ? 'Already formatted' : 'Will add Token prefix');
            }
            
            // console.log('Sending profile update request:', profileData);
            const response = await api.put('/user/update/', profileData);
            // console.log('Profile update API response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Profile update error:', error.response);
            
            if (error.response?.data) {
                const errorData = error.response.data;
                
                // Handle validation errors
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
                
                throw new Error(
                    errorData.detail || 
                    errorData.message ||
                    `Erreur ${error.response.status}: ${JSON.stringify(errorData)}`
                );
            }
            
            throw new Error(`Erreur lors de la mise à jour du profil (${error.response?.status || 'inconnu'})`);
        }
    },

    // Change password
    changePassword: async (passwordData) => {
        try {
            const response = await api.put('/user/password/', passwordData);
            return response.data;
        } catch (error) {
            console.error('Password change error:', error.response);
            throw new Error(
                error.response?.data?.detail || 
                error.response?.data?.message ||
                'Erreur lors du changement de mot de passe'
            );
        }
    },

    // Update user avatar
    updateAvatar: async (avatarData) => {
        try {
            const response = await avatarApi.patch('/user/avatar/', avatarData);
            return response.data;
        } catch (error) {
            console.error('Avatar upload error:', error.response);
            throw new Error(
                error.response?.data?.detail || 
                error.response?.data?.message ||
                'Erreur lors de la mise à jour de l\'avatar'
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
        // Must be at least 8 characters (backend requirement)
        return password && password.length >= 8;
    },

    validatePasswordChange: (oldPassword, newPassword, confirmPassword) => {
        const errors = [];
        
        if (!oldPassword || oldPassword.trim() === '') {
            errors.push('L\'ancien mot de passe est requis');
        }
        
        if (!newPassword || newPassword.length < 8) {
            errors.push('Le nouveau mot de passe doit contenir au moins 8 caractères');
        }
        
        if (newPassword !== confirmPassword) {
            errors.push('La confirmation du mot de passe ne correspond pas');
        }
        
        if (oldPassword === newPassword) {
            errors.push('Le nouveau mot de passe doit être différent de l\'ancien');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    },

    validateUsername: (username) => {
        const re = /^[a-zA-Z0-9_]{3,20}$/;
        return re.test(username);
    },

    validateRequired: (value) => {
        return value && value.toString().trim() !== '';
    }
};

// Utility functions for file handling
export const fileUtils = {
    // Convert file to Base64
    fileToBase64: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    },

    // Validate image file
    validateImageFile: (file) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 5 * 1024 * 1024; // 5MB
        
        if (!allowedTypes.includes(file.type)) {
            throw new Error('Type de fichier non supporté. Utilisez JPG, PNG, GIF ou WebP.');
        }
        
        if (file.size > maxSize) {
            throw new Error('Le fichier est trop volumineux. Taille maximale: 5MB.');
        }
        
        return true;
    }
};

// Favorites API
export const favorisAPI = {
    // Ajouter un élément aux favoris - POST /api/bnn/favoris/
    addFavori: async (ressourceId) => {
        try {
            const response = await api.post('/favoris/', {
                ressource_id: ressourceId
            });
            return response.data;
        } catch (error) {
            // Handle specific error cases
            if (error.response?.status === 409) {
                throw new Error('Cette ressource est déjà dans vos favoris');
            }
            throw new Error(
                error.response?.data?.detail || 
                error.response?.data?.message || 
                'Erreur lors de l\'ajout aux favoris'
            );
        }
    },

    // Consulter la liste des favoris - GET /api/bnn/favoris/
    getFavoris: async () => {
        try {
            const response = await api.get('/favoris/');
            return response.data;
        } catch (error) {
            throw new Error(
                error.response?.data?.detail || 
                error.response?.data?.message || 
                'Erreur lors du chargement des favoris'
            );
        }
    },

    // Supprimer un favori - DELETE /api/bnn/favoris/25/
    removeFavori: async (ressourceId) => {
        try {
            const response = await api.delete(`/favoris/${ressourceId}/`);
            return response.data;
        } catch (error) {
            throw new Error(
                error.response?.data?.detail || 
                error.response?.data?.message || 
                'Erreur lors de la suppression du favori'
            );
        }
    },

    // Vérifier si une ressource est dans les favoris
    checkFavori: async (ressourceId) => {
        try {
            const favoris = await favorisAPI.getFavoris();
            const favorisData = favoris.results || favoris.data || favoris;
            
            if (Array.isArray(favorisData)) {
                return favorisData.some(favori => 
                    favori.ressource_id === ressourceId || 
                    favori.ressource?.id === ressourceId ||
                    favori.id === ressourceId
                );
            }
            return false;
        } catch (error) {
            console.warn('Erreur lors de la vérification des favoris:', error);
            return false;
        }
    }
};

// Salons API (module Salon v2 : voir bnn-esursi-server/menu/salons/)
const salonRequest = async (request, fallback) => {
    try {
        const response = await request();
        return response.data;
    } catch (error) {
        const data = error.response?.data;
        const fieldErrors = data?.errors && typeof data.errors === 'object'
            ? Object.values(data.errors).flat().filter(Boolean).join(' ')
            : '';
        const wrapped = new Error(data?.detail || data?.message || fieldErrors || fallback);
        wrapped.status = error.response?.status;
        wrapped.code = data?.code;
        wrapped.dateOuverture = data?.date_ouverture;
        throw wrapped;
    }
};

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

export const salonsAPI = {
    getSalons: (search = '', filtre = '') => salonRequest(
        () => api.get('/salons/', { params: { ...(search ? { search } : {}), ...(filtre ? { filtre } : {}) } }),
        'Erreur lors du chargement des salons'
    ),
    markSalonsSeen: () => salonRequest(() => api.post('/salons/vu/'), 'Erreur lors de la mise à jour'),
    getSalon: (salonId) => salonRequest(() => api.get(`/salons/${salonId}/`), 'Erreur lors du chargement du salon'),
    createSalon: (formData) => salonRequest(() => api.post('/salons/', formData, multipart), 'Erreur lors de la création du salon'),
    updateSalon: (salonId, salonData) => salonRequest(() => api.patch(`/salons/${salonId}/`, salonData), 'Erreur lors de la modification du salon'),
    closeSalon: (salonId) => salonRequest(() => api.post(`/salons/${salonId}/fermer/`), 'Erreur lors de la fermeture du salon'),
    reopenSalon: (salonId) => salonRequest(() => api.post(`/salons/${salonId}/rouvrir/`), 'Erreur lors de la réouverture du salon'),
    deleteSalon: (salonId) => salonRequest(() => api.delete(`/salons/${salonId}/`), 'Erreur lors de la suppression du salon'),
    addRessources: (salonId, formData) => salonRequest(() => api.post(`/salons/${salonId}/ressources/`, formData, multipart), "Erreur lors de l'ajout des ressources"),
    deleteRessource: (salonId, ressourceId) => salonRequest(() => api.delete(`/salons/${salonId}/ressources/${ressourceId}/`), 'Erreur lors du retrait de la ressource'),
    joinSalon: (salonId) => salonRequest(() => api.post(`/salons/${salonId}/join/`), "Erreur lors de l'adhésion au salon"),
    getInvitationLink: (salonId) => salonRequest(() => api.get(`/salons/${salonId}/lien-invitation/`), "Erreur lors de la création du lien d'invitation"),
    joinByInvitation: (token) => salonRequest(() => api.post('/salons/rejoindre/', { token }), "Ce lien d'invitation n'est pas valide"),
    quitSalon: (salonId) => salonRequest(() => api.post(`/salons/${salonId}/quit/`), 'Erreur lors de la sortie du salon'),
    markRead: (salonId, messageId = null) => salonRequest(
        () => api.post(`/salons/${salonId}/lu/`, messageId ? { message_id: messageId } : {}),
        'Erreur lors du marquage comme lu'
    ),
    getMembers: (salonId) => salonRequest(() => api.get(`/salons/${salonId}/members/`), 'Erreur lors du chargement des membres'),
    memberAction: (salonId, userId, action) => salonRequest(
        () => api.post(`/salons/${salonId}/membres/${userId}/${action}/`),
        "Erreur lors de l'action sur le membre"
    ),
    invite: (salonId, userIds) => salonRequest(() => api.post(`/salons/${salonId}/inviter/`, { utilisateurs: userIds }), "Erreur lors de l'invitation"),
    searchUsers: (search) => salonRequest(() => api.get('/salons/utilisateurs/', { params: { search } }), 'Erreur lors de la recherche'),

    // Réunion vidéo (LiveKit) : état, entrée (démarre la réunion si besoin), fin pour tous.
    getReunion: (salonId) => salonRequest(() => api.get(`/salons/${salonId}/reunion/`), 'Erreur lors du chargement de la réunion'),
    joinReunion: (salonId) => salonRequest(() => api.post(`/salons/${salonId}/reunion/`), "Impossible d'entrer dans la réunion"),
    endReunion: (salonId) => salonRequest(() => api.post(`/salons/${salonId}/reunion/terminer/`), 'Impossible de terminer la réunion'),

    getMessages: (salonId, { afterId = null, beforeId = null, search = '', limit = null } = {}) => salonRequest(
        () => api.get(`/salons/${salonId}/messages/`, {
            params: {
                ...(afterId ? { after_id: afterId } : {}),
                ...(beforeId ? { before_id: beforeId } : {}),
                ...(search ? { search } : {}),
                ...(limit ? { limit } : {})
            }
        }),
        'Erreur lors du chargement des messages'
    ),
    sendMessage: (salonId, payload) => salonRequest(
        () => api.post(`/salons/${salonId}/messages/`, payload, payload instanceof FormData ? multipart : undefined),
        "Erreur lors de l'envoi du message"
    ),
    editMessage: (salonId, messageId, contenu) => salonRequest(
        () => api.patch(`/salons/${salonId}/messages/${messageId}/`, { contenu }),
        'Erreur lors de la modification du message'
    ),
    deleteMessage: (salonId, messageId) => salonRequest(
        () => api.delete(`/salons/${salonId}/messages/${messageId}/`),
        'Erreur lors de la suppression du message'
    ),
    pinMessage: (salonId, messageId, epingle) => salonRequest(
        () => api.post(`/salons/${salonId}/messages/${messageId}/epingler/`, { epingle }),
        "Erreur lors de l'épinglage"
    ),
    reactToMessage: (salonId, messageId, emoji) => salonRequest(
        () => api.post(`/salons/${salonId}/messages/${messageId}/reactions/`, { emoji }),
        'Erreur lors de la réaction'
    ),
    reportMessage: (salonId, messageId, motif) => salonRequest(
        () => api.post(`/salons/${salonId}/messages/${messageId}/signaler/`, { motif }),
        'Erreur lors du signalement'
    ),
    getReports: (salonId) => salonRequest(() => api.get(`/salons/${salonId}/signalements/`), 'Erreur lors du chargement des signalements'),
    resolveReport: (salonId, reportId) => salonRequest(
        () => api.post(`/salons/${salonId}/signalements/${reportId}/traiter/`),
        'Erreur lors du traitement du signalement'
    ),

    getNotifications: (unreadOnly = false) => salonRequest(
        () => api.get('/salons/notifications/', { params: unreadOnly ? { unread_only: 1 } : {} }),
        'Erreur lors du chargement des notifications'
    ),
    markNotificationsRead: (salonId = null) => salonRequest(
        () => api.post('/salons/notifications/mark-read/', salonId ? { salon_id: salonId } : {}),
        'Erreur lors du marquage des notifications'
    ),
    markNotificationRead: (notificationId) => salonRequest(
        () => api.post(`/salons/notifications/${notificationId}/mark-read/`),
        'Erreur lors du marquage de la notification'
    ),

    // Recherche de ressources à partager dans un salon
    searchBnnRessources: (q) => salonRequest(
        () => api.get('/ressources/search/', { params: { q, limit: 8, offset: 0 } }),
        'Erreur lors de la recherche dans la BNN'
    )
};

// Statistiques des actions sur les ressources
export const ressourcesStatsAPI = {
    getActionsStats: async (params = {}, options = {}) => {
        try {
            const response = await api.get('/ressources/statistiques-actions/', {
                params,
                signal: options.signal
            });
            return response.data;
        } catch (error) {
            throw new Error(
                error.response?.data?.detail ||
                error.response?.data?.message ||
                'Erreur lors du chargement des statistiques'
            );
        }
    }
};

// Domaines API
export const domainesAPI = {
    // Get all domains
    getDomaines: async () => {
        try {
            const response = await api.get('/domaines/');
            return response.data;
        } catch (error) {
            throw new Error(
                error.response?.data?.detail || 
                error.response?.data?.message || 
                'Erreur lors du chargement des domaines'
            );
        }
    },

    // Get resources by domain
    getResourcesByDomain: async (domaineId) => {
        try {
            const response = await api.get(`/domaines/${domaineId}/ressources/`);
            return response.data;
        } catch (error) {
            throw new Error(
                error.response?.data?.detail || 
                error.response?.data?.message || 
                'Erreur lors du chargement des ressources du domaine'
            );
        }
    }
};

// Export the main API instance
export default api;
