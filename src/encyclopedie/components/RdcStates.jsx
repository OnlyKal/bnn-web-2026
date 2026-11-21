import React from 'react';
import { LuRefreshCw, LuSearch, LuWifiOff } from 'react-icons/lu';

export const RdcLoading = ({ label = 'Chargement…', variant = 'cards', count = 6 }) => (
    <div className="rdc-loading" role="status" aria-live="polite">
        <span className="rdc-visually-hidden">{label}</span>
        {variant === 'cards' ? (
            <div className="rdc-card-grid">
                {Array.from({ length: count }).map((_, index) => (
                    <div key={index} className="rdc-card rdc-card-skeleton" aria-hidden="true">
                        <div className="rdc-skeleton rdc-skeleton-media" />
                        <div className="rdc-card-body">
                            <div className="rdc-skeleton rdc-skeleton-line short" />
                            <div className="rdc-skeleton rdc-skeleton-line" />
                            <div className="rdc-skeleton rdc-skeleton-line" />
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="rdc-skeleton-block" aria-hidden="true">
                <div className="rdc-skeleton rdc-skeleton-hero" />
                <div className="rdc-skeleton rdc-skeleton-line" />
                <div className="rdc-skeleton rdc-skeleton-line" />
                <div className="rdc-skeleton rdc-skeleton-line short" />
            </div>
        )}
    </div>
);

export const RdcError = ({ error, onRetry }) => (
    <div className="rdc-state rdc-state-error" role="alert">
        <LuWifiOff size={28} aria-hidden="true" />
        <h2>Le chargement a échoué</h2>
        <p>{error?.message || 'Veuillez réessayer.'}</p>
        {onRetry && (
            <button type="button" className="rdc-button" onClick={onRetry}>
                <LuRefreshCw size={16} aria-hidden="true" />
                Réessayer
            </button>
        )}
    </div>
);

export const RdcEmpty = ({ title = 'Aucun résultat', message, icon = LuSearch, children }) => {
    const Icon = icon;
    return (
        <div className="rdc-state">
            <Icon size={28} aria-hidden="true" />
            <h2>{title}</h2>
            {message && <p>{message}</p>}
            {children}
        </div>
    );
};
