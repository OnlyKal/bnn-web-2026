import React, { useEffect, useRef, useState } from 'react';
import { FaComments, FaEllipsisH, FaGlobeAfrica, FaLink, FaPlus } from 'react-icons/fa';
import VisibilityBadge from './VisibilityBadge';

/** Menu « ⋯ » : les actions secondaires du salon, pour garder l'en-tête lisible. */
export const ActionsMenu = ({ items }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
        const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const visible = items.filter(Boolean);
    if (!visible.length) return null;
    return (
        <div className="salon-actions-menu" ref={ref}>
            <button
                type="button"
                className="salons-secondary-btn salon-actions-toggle"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Plus d'actions"
                onClick={() => setOpen((v) => !v)}
            >
                <FaEllipsisH />
            </button>
            {open && (
                <div className="salon-actions-dropdown" role="menu">
                    {visible.map((item) => (
                        <button
                            type="button"
                            role="menuitem"
                            key={item.label}
                            className={item.danger ? 'danger' : ''}
                            disabled={item.disabled}
                            onClick={() => { setOpen(false); item.onClick(); }}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

/** Fenêtre de confirmation claire, pour les actions qu'on ne peut pas annuler. */
export const ConfirmDialog = ({ open, title, children, confirmLabel, onConfirm, onCancel, busy = false }) => {
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => { if (event.key === 'Escape') onCancel(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onCancel]);

    if (!open) return null;
    return (
        <div className="salon-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
            <div className="salon-dialog" role="alertdialog" aria-modal="true" aria-labelledby="salon-dialog-title">
                <h3 id="salon-dialog-title">{title}</h3>
                <div className="salon-dialog-body">{children}</div>
                <div className="salon-dialog-actions">
                    <button type="button" className="salons-secondary-btn" onClick={onCancel} autoFocus>Annuler</button>
                    <button type="button" className="salons-danger-btn salon-dialog-confirm" onClick={onConfirm} disabled={busy}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

/** Écran d'accueil quand aucun salon n'est ouvert. */
export const SalonsWelcome = ({ salons, onCreate, onJoinWithLink, onOpen }) => {
    const suggestions = salons
        .filter((salon) => !salon.est_membre && !salon.est_createur && !salon.ferme && salon.visibilite !== 'prive')
        .sort((a, b) => (b.membres_count || 0) - (a.membres_count || 0))
        .slice(0, 4);
    return (
        <div className="salons-welcome">
            <FaComments className="salons-welcome-icon" />
            <h2>Bienvenue dans les salons</h2>
            <p>Échangez avec d'autres étudiants et enseignants autour d'un sujet, et partagez des ressources.</p>
            <div className="salons-welcome-actions">
                <button type="button" className="salons-primary-btn" onClick={onCreate}><FaPlus /> Créer un salon</button>
                <button type="button" className="salons-secondary-btn" onClick={onJoinWithLink}><FaLink /> Rejoindre avec un lien</button>
            </div>
            {suggestions.length > 0 && (
                <div className="salons-welcome-suggestions">
                    <h3><FaGlobeAfrica /> Salons publics à découvrir</h3>
                    {suggestions.map((salon) => (
                        <button type="button" key={salon.id} onClick={() => onOpen(salon)}>
                            <strong>{salon.titre}</strong>
                            <span>{salon.description}</span>
                            <small>{salon.membres_count || 0} membre(s) <VisibilityBadge salon={salon} /></small>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
