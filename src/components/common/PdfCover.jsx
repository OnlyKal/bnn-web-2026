import React from 'react';
import '../../styles/PdfCover.css';

/** Logo PDF : page à coin replié et étiquette rouge. */
export const PdfLogo = ({ className = '' }) => (
    <svg className={`pdf-logo ${className}`.trim()} viewBox="0 0 48 60" role="img" aria-label="PDF">
        <path d="M4 1.5h28L46.5 16v40.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-53a2 2 0 0 1 2-2Z" fill="#fff" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M32 1.5V14a2 2 0 0 0 2 2h12.5" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="9" y="22" width="22" height="2.5" rx="1.25" fill="#e2e8f0" />
        <rect x="9" y="28" width="30" height="2.5" rx="1.25" fill="#e2e8f0" />
        <rect x="0" y="36" width="40" height="15" rx="2.5" fill="#dc2626" />
        <text x="20" y="47.2" textAnchor="middle" fill="#fff" fontFamily="Arial, Helvetica, sans-serif" fontSize="11" fontWeight="700" letterSpacing="0.6">PDF</text>
    </svg>
);

/** Couverture de remplacement pour un PDF sans couverture. */
const PdfCover = ({ className = '', children }) => (
    <div className={`pdf-cover ${className}`.trim()}>
        <PdfLogo />
        {children}
    </div>
);

export default PdfCover;
