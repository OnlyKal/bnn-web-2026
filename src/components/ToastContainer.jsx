import React from 'react';
import { FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaInfoCircle, FaTimes } from 'react-icons/fa';
import '../styles/Toast.css';

export const Toast = ({ toast, onClose }) => {
    const getIcon = () => {
        switch (toast.type) {
            case 'success':
                return <FaCheckCircle className="toast-icon" />;
            case 'error':
                return <FaTimesCircle className="toast-icon" />;
            case 'warning':
                return <FaExclamationTriangle className="toast-icon" />;
            case 'info':
                return <FaInfoCircle className="toast-icon" />;
            default:
                return <FaInfoCircle className="toast-icon" />;
        }
    };

    return (
        <div className={`toast toast-${toast.type}`}>
            <div className="toast-content">
                {getIcon()}
                <span className="toast-message">{toast.message}</span>
            </div>
            <button className="toast-close" onClick={onClose}>
                <FaTimes />
            </button>
        </div>
    );
};

export const ToastContainer = ({ toasts, onClose }) => {
    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <Toast
                    key={toast.id}
                    toast={toast}
                    onClose={() => onClose(toast.id)}
                />
            ))}
        </div>
    );
};
