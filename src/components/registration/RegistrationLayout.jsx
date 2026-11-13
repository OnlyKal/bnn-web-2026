import React from 'react';
import { FaArrowLeft, FaCheck, FaHome, FaSignOutAlt } from 'react-icons/fa';
import logoBnn from '../../assets/Logobleu.png';
import '../../styles/Registration.css';

const STEPS = ['Province', 'Établissement', 'Profil', 'Informations'];

/** Étapes 1 à 3 de l'inscription : en-tête, progression, rappel des choix et contenu. */
function RegistrationLayout({
    step,
    title,
    subtitle,
    summary = [],
    back,
    isAuthenticated,
    onHome,
    onLogout,
    children
}) {
    return (
        <div className="reg-page">
            <header className="reg-topbar">
                <div className="reg-topbar-inner">
                    <img src={logoBnn} alt="BNN-ESURSI" className="reg-topbar-logo" />
                    <div className="reg-topbar-actions">
                        {isAuthenticated ? (
                            <>
                                <button type="button" className="reg-btn reg-btn-ghost" onClick={onHome}>
                                    <FaHome aria-hidden="true" /> Accueil
                                </button>
                                <button type="button" className="reg-btn reg-btn-danger" onClick={onLogout}>
                                    <FaSignOutAlt aria-hidden="true" /> Déconnexion
                                </button>
                            </>
                        ) : back && (
                            <button type="button" className="reg-btn reg-btn-ghost" onClick={back.onClick}>
                                <FaArrowLeft aria-hidden="true" /> {back.label}
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="reg-main">
                <ol className="reg-steps" aria-label="Étapes de l'inscription">
                    {STEPS.map((label, index) => {
                        const number = index + 1;
                        const state = number < step ? 'done' : number === step ? 'current' : 'todo';
                        return (
                            <li key={label} className={`reg-step ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                                <span className="reg-step-dot">{state === 'done' ? <FaCheck aria-hidden="true" /> : number}</span>
                                <span className="reg-step-label">{label}</span>
                            </li>
                        );
                    })}
                </ol>

                <div className="reg-heading">
                    <p className="reg-kicker">Étape {step} sur {STEPS.length}</p>
                    <h1 className="reg-title">{title}</h1>
                    {subtitle && <p className="reg-subtitle">{subtitle}</p>}
                </div>

                {summary.length > 0 && (
                    <div className="reg-summary">
                        {summary.map(({ label, value, onEdit }) => (
                            <div key={label} className="reg-summary-item">
                                <span className="reg-summary-label">{label}</span>
                                <span className="reg-summary-value" title={value}>{value}</span>
                                {onEdit && (
                                    <button type="button" className="reg-summary-edit" onClick={onEdit}>
                                        Modifier
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {children}
            </main>
        </div>
    );
}

export default RegistrationLayout;
