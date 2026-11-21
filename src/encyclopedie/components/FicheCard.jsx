import React from 'react';
import { Link } from 'react-router-dom';
import { LuCalendar, LuMapPin } from 'react-icons/lu';
import { categoryIcon, mediaUrl } from '../rdcUtils';

const FicheCard = ({ fiche, compact = false }) => {
    const Icon = categoryIcon(fiche.categorie?.icone);
    const couleur = fiche.categorie?.couleur || '#1e42ac';
    const image = mediaUrl(fiche.image);
    const provinces = fiche.provinces || [];

    return (
        <Link
            to={`/rdc/fiche/${fiche.slug}`}
            className={`rdc-card ${compact ? 'rdc-card-compact' : ''}`}
            style={{ '--rdc-accent': couleur }}
        >
            <div className="rdc-card-media">
                {image ? (
                    <img src={image} alt="" loading="lazy" decoding="async" />
                ) : (
                    <div className="rdc-card-placeholder" aria-hidden="true">
                        <Icon size={compact ? 24 : 34} />
                    </div>
                )}
                {fiche.libelle_dates && (
                    <span className="rdc-card-date">
                        <LuCalendar size={12} aria-hidden="true" />
                        {fiche.libelle_dates}
                    </span>
                )}
            </div>
            <div className="rdc-card-body">
                <span className="rdc-card-kicker">
                    <Icon size={13} aria-hidden="true" />
                    {fiche.categorie?.nom}
                </span>
                <h3 className="rdc-card-title">{fiche.titre}</h3>
                {!compact && fiche.resume && <p className="rdc-card-summary">{fiche.resume}</p>}
                <div className="rdc-card-meta">
                    <span className="rdc-chip">{fiche.nature_label}</span>
                    {provinces.length > 0 && (
                        <span className="rdc-card-place">
                            <LuMapPin size={12} aria-hidden="true" />
                            {provinces.slice(0, 2).map((p) => p.nom).join(', ')}
                            {provinces.length > 2 ? ` +${provinces.length - 2}` : ''}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
};

export default FicheCard;
