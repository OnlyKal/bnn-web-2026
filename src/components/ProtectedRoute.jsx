import React, { useEffect, useState } from 'react';
import { isAuthenticated, getCurrentUser, isSessionExpired, logout } from '../utils/auth';

/**
 * ProtectedRoute component to protect pages that require authentication
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render if authenticated
 * @param {string} props.redirectTo - URL to redirect to if not authenticated (default: '/login')
 * @param {Array} props.allowedRoles - Array of roles allowed to access this route (optional)
 */
function ProtectedRoute({ children, redirectTo = '/login', allowedRoles = null }) {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        checkAuthentication();
    }, []);

    const checkAuthentication = () => {
        // Check if user is authenticated
        if (!isAuthenticated()) {
            console.log('User not authenticated, redirecting to login');
            window.location.href = redirectTo;
            return;
        }

        // Check if session has expired
        if (isSessionExpired(24)) { // 24 hours expiration
            console.log('Session expired, logging out');
            logout();
            window.location.href = redirectTo;
            return;
        }

        // Check role-based access if allowedRoles is specified
        if (allowedRoles && allowedRoles.length > 0) {
            const user = getCurrentUser();
            if (!user || !allowedRoles.includes(user.role)) {
                console.log('User role not authorized for this route');
                // Redirect to unauthorized page or home
                window.location.href = '/unauthorized';
                return;
            }
        }

        setIsAuthorized(true);
        setIsLoading(false);
    };

    // Show loading spinner while checking authentication
    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">Vérification de l'authentification...</p>
            </div>
        );
    }

    // Render children if authorized
    if (isAuthorized) {
        return children;
    }

    // This should not be reached due to redirects above, but just in case
    return null;
}

export default ProtectedRoute;