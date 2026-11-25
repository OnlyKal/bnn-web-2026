import React from 'react';
import { FaGlobeAfrica, FaLock } from 'react-icons/fa';

/** Étiquette « Public » / « Privé » d'un salon. */
const VisibilityBadge = ({ salon }) => {
    if (!salon) return null;
    const prive = salon.visibilite === 'prive';
    return (
        <span
            className={`salon-badge salon-visibility-badge ${prive ? 'prive' : 'public'}`}
            title={prive ? 'Salon privé : sur invitation ou demande' : 'Salon public : ouvert à tous'}
        >
            {prive ? <FaLock aria-hidden="true" /> : <FaGlobeAfrica aria-hidden="true" />}
            {prive ? 'Privé' : 'Public'}
        </span>
    );
};

export default VisibilityBadge;
