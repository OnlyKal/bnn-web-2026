import React from 'react';
import { Link } from 'react-router-dom';
import { LuArrowRight, LuCalendar, LuMapPin } from 'react-icons/lu';
import { categoryIcon, formatNumber, hiRes, mediaUrl } from '../rdcUtils';

/** Titre de section : petite mention, titre, lien « voir plus » optionnel. */
export const SectionTitle = ({ eyebrow, title, action, to, id }) => (
    <div className="mp-section-head">
        <div>
            {eyebrow && <span className="mp-eyebrow">{eyebrow}</span>}
            <h2 id={id}>{title}</h2>
        </div>
        {action && <Link to={to} className="mp-link">{action} <LuArrowRight size={15} aria-hidden="true" /></Link>}
    </div>
);

/**
 * Bannière de page (thème, exploration, provinces…) : image en fond si disponible,
 * sinon dégradé aux couleurs du thème.
 */
export const PageBanner = ({ image, color = '#1e42ac', icon, eyebrow, title, description, chips = [], children, compact = false }) => {
    const Icon = icon;
    const src = hiRes(image, 1600);
    return (
        <header className={`mp-banner ${src ? 'has-image' : ''} ${compact ? 'compact' : ''}`} style={{ '--mp-accent': color }}>
            {src && <img src={src} alt="" className="mp-banner-img" fetchPriority="high" />}
            <div className="mp-banner-shade" aria-hidden="true" />
            <div className="mp-banner-body">
                {Icon && <span className="mp-banner-icon"><Icon size={26} aria-hidden="true" /></span>}
                <div className="mp-banner-text">
                    {eyebrow && <span className="mp-banner-eyebrow">{eyebrow}</span>}
                    <h1>{title}</h1>
                    {description && <p>{description}</p>}
                    {chips.length > 0 && (
                        <ul className="mp-banner-chips">
                            {chips.filter(Boolean).map((chip) => <li key={chip}>{chip}</li>)}
                        </ul>
                    )}
                    {children && <div className="mp-banner-actions">{children}</div>}
                </div>
            </div>
        </header>
    );
};

/** Tuiles de chiffres clés (valeur mise en avant, libellé, détail). */
export const StatTiles = ({ items }) => {
    const visible = items.filter((item) => item && item.value !== null && item.value !== undefined && item.value !== '');
    if (!visible.length) return null;
    return (
        <dl className="mp-stats">
            {visible.map((item) => {
                const Icon = item.icon;
                return (
                    <div key={item.label} className="mp-stat">
                        {Icon && <span className="mp-stat-icon"><Icon size={17} aria-hidden="true" /></span>}
                        <dt>{item.label}</dt>
                        <dd>{typeof item.value === 'number' ? formatNumber(item.value) : item.value}{item.unit && <small> {item.unit}</small>}</dd>
                        {item.hint && <small className="mp-stat-hint">{item.hint}</small>}
                    </div>
                );
            })}
        </dl>
    );
};

/** Ligne de fiche (vue liste). */
export const FicheRow = ({ fiche }) => {
    const Icon = categoryIcon(fiche.categorie?.icone);
    const image = mediaUrl(fiche.image);
    return (
        <Link to={`/rdc/fiche/${fiche.slug}`} className="mp-row" style={{ '--mp-accent': fiche.categorie?.couleur || '#1e42ac' }}>
            <span className="mp-row-media">
                {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <Icon size={22} aria-hidden="true" />}
            </span>
            <span className="mp-row-body">
                <span className="mp-row-kicker"><Icon size={12} aria-hidden="true" /> {fiche.categorie?.nom}</span>
                <strong>{fiche.titre}</strong>
                {fiche.resume && <span className="mp-row-summary">{fiche.resume}</span>}
                <span className="mp-row-meta">
                    <span className="rdc-chip">{fiche.nature_label}</span>
                    {fiche.libelle_dates && <span><LuCalendar size={12} aria-hidden="true" /> {fiche.libelle_dates}</span>}
                    {fiche.provinces?.length > 0 && <span><LuMapPin size={12} aria-hidden="true" /> {fiche.provinces.map((p) => p.nom).join(', ')}</span>}
                </span>
            </span>
            <LuArrowRight className="mp-row-arrow" size={18} aria-hidden="true" />
        </Link>
    );
};
