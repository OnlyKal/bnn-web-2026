import { useState, useCallback } from 'react';

export const useToast = () => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration = 5000) => {
        const id = Date.now();
        const newToast = {
            id,
            message,
            type // 'success', 'error', 'warning', 'info'
        };

        setToasts(prev => [...prev, newToast]);

        // Auto-remove toast after duration
        if (duration > 0) {
            const timer = setTimeout(() => {
                removeToast(id);
            }, duration);

            return () => clearTimeout(timer);
        }

        return () => removeToast(id);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const showSuccess = useCallback((message, duration = 3000) => {
        addToast(message, 'success', duration);
    }, [addToast]);

    const showError = useCallback((message, duration = 5000) => {
        addToast(message, 'error', duration);
    }, [addToast]);

    const showWarning = useCallback((message, duration = 4000) => {
        addToast(message, 'warning', duration);
    }, [addToast]);

    const showInfo = useCallback((message, duration = 3000) => {
        addToast(message, 'info', duration);
    }, [addToast]);

    return {
        toasts,
        addToast,
        removeToast,
        showSuccess,
        showError,
        showWarning,
        showInfo
    };
};
