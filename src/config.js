/**
 * Application Configuration
 * 
 * This file contains all configuration variables for the application.
 * Update the API_SERVER_URL to point to your backend server.
 * 
 * You can also use environment variables by creating a .env file:
 * VITE_API_SERVER_URL=http://your-server-url.com
 */

// API Server Base URL (without /api/bnn path)
// Uses environment variable if available, otherwise defaults to localhost
export const API_SERVER_URL = import.meta.env.VITE_API_SERVER_URL || 'https://admin.cgiibnn-esursi.cd';
// export const API_SERVER_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:8000';

// API Base URL (with /api/bnn path)
export const API_BASE_URL = `${API_SERVER_URL}/api/bnn`;

// Helper function to construct full URL for media files
export const getMediaUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${API_SERVER_URL}${path}`;
};

// Helper function to construct full file URL
export const getFileUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${API_SERVER_URL}${path}`;
};

// Export for backward compatibility
export default {
    API_SERVER_URL,
    API_BASE_URL,
    getMediaUrl,
    getFileUrl
};
