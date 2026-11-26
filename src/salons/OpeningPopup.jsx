import React, { useEffect } from 'react';
import { FaClock, FaTimes } from 'react-icons/fa';

export const OPENING_POPUP_MS = 5000;

/** Petit message affiché 5 secondes quand on tente d'entrer avant l'heure d'ouverture. */
const OpeningPopup = ({ message, onClose }) => {
    useEffect(() => {
        if (!message) return undefined;
        const timer = setTimeout(onClose, OPENING_POPUP_MS);
        return () => clearTimeout(timer);
    }, [message, onClose]);

    if (!message) return null;
    return (
        <div className="salon-opening-overlay" role="presentation" onClick={onClose}>
            <div className="salon-opening-popup" role="alertdialog" aria-live="assertive" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="salon-opening-close" aria-label="Fermer" onClick={onClose}><FaTimes /></button>
                <FaClock className="salon-opening-icon" />
                <strong>Pas encore ouvert</strong>
                <p>{message}</p>
                <span className="salon-opening-progress" style={{ animationDuration: `${OPENING_POPUP_MS}ms` }} />
            </div>
        </div>
    );
};

export default OpeningPopup;
