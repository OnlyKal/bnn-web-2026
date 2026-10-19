// Authentication utility functions

/**
 * Save user session to localStorage
 * @param {string} token - JWT token from server
 * @param {object} userData - User data object
 */
export const saveSession = (token, userData) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('userData', JSON.stringify(userData));
    localStorage.setItem('loginTime', new Date().getTime().toString());
};

/**
 * Get current session from localStorage
 * @returns {object} - Object containing token and userData
 */
export const getSession = () => {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    const loginTime = localStorage.getItem('loginTime');
    
    return {
        token,
        userData: userData ? JSON.parse(userData) : null,
        loginTime: loginTime ? parseInt(loginTime) : null
    };
};

/**
 * Clear user session from localStorage
 */
export const clearSession = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('loginTime');
};

/**
 * Check if user is authenticated
 * @returns {boolean} - True if user has valid session
 */
export const isAuthenticated = () => {
    const { token, userData } = getSession();
    return !!(token && userData);
};

/**
 * Get current user data
 * @returns {object|null} - User data or null if not authenticated
 */
export const getCurrentUser = () => {
    const { userData } = getSession();
    return userData;
};

const getUserField = (user, fields) => {
    if (!user) return '';

    const source = user.user || user.profile || user.profil || user;
    for (const field of fields) {
        if (source?.[field]) return String(source[field]).trim();
        if (user?.[field]) return String(user[field]).trim();
    }

    return '';
};

export const getUserDisplayName = (user, fallback = 'Utilisateur') => {
    const fullName = getUserField(user, ['full_name', 'name', 'nom_complet']);
    if (fullName) return fullName;

    const nom = getUserField(user, ['nom', 'last_name']);
    const prenom = getUserField(user, ['prenom', 'first_name']);
    const username = getUserField(user, ['username']);
    const email = getUserField(user, ['email']);

    return [nom, prenom].filter(Boolean).join(' ') || username || email || fallback;
};

export const getUserHandle = (user) => {
    const username = getUserField(user, ['username']);
    const email = getUserField(user, ['email']);

    if (username) return username.startsWith('@') ? username : `@${username}`;
    return email || '';
};

/**
 * Get authorization header for API requests
 * @returns {object} - Authorization header object
 */
export const getAuthHeader = () => {
    const { token } = getSession();
    if (token) {
        return {
            'Authorization': token
        };
    }
    return {};
};

/**
 * Check if session has expired (optional - based on your token expiration logic)
 * @param {number} expirationHours - Number of hours after which session expires
 * @returns {boolean} - True if session has expired
 */
export const isSessionExpired = (expirationHours = 24) => {
    const { loginTime } = getSession();
    if (!loginTime) return true;
    
    const now = new Date().getTime();
    const hoursDifference = (now - loginTime) / (1000 * 60 * 60);
    
    return hoursDifference > expirationHours;
};

/**
 * Logout user and clear session
 */
export const logout = () => {
    clearSession();
    // Optional: Redirect to login page
    // window.location.href = '/login';
};
