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
export const API_SERVER_URL = import.meta.env.VITE_API_SERVER_URL || 'https://admin-bnn.minesursi.gouv.cd';
// export const API_SERVER_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:8000';

// API Base URL (with /api/bnn path)
export const API_BASE_URL = `${API_SERVER_URL}/api/bnn`;

// Encyclopédie RDC (API publique, voir encyclopedie/ côté serveur)
export const RDC_API_URL = `${API_BASE_URL}/rdc`;

// Fond de carte des cartes interactives (surchargeable : VITE_MAP_TILE_URL / VITE_MAP_ATTRIBUTION)
export const MAP_TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const MAP_ATTRIBUTION = import.meta.env.VITE_MAP_ATTRIBUTION
    || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

// Static Assets Base URL (pour les images locales)
export const ASSETS_URL = '/assets';

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

// Helper function to construct asset URL (local images)
export const getAssetUrl = (assetPath) => {
    if (!assetPath) return null;
    if (assetPath.startsWith('http')) return assetPath;
    // Remove leading slash if present
    const cleanPath = assetPath.startsWith('/') ? assetPath.substring(1) : assetPath;
    return `${ASSETS_URL}/${cleanPath}`;
};

// Export for backward compatibility
export default {
    API_SERVER_URL,
    API_BASE_URL,
    ASSETS_URL,
    getMediaUrl,
    getFileUrl,
    getAssetUrl
};
