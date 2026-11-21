import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LuCalendar, LuClock, LuMapPin, LuUser, LuX } from 'react-icons/lu';
import RdcLayout from './components/RdcLayout';
import { PageBanner } from './components/MpParts';
import { RdcEmpty, RdcError, RdcLoading } from './components/RdcStates';
import useRdcData from './useRdcData';
import { encyclopedieAPI } from '../services/encyclopedieApi';
import { categoryIcon, formatYear, mediaUrl, readSearchParams } from './rdcUtils';

const FILTER_KEYS = ['periode', 'nature', 'categorie', 'province', 'q'];
const NATURE_SHORTCUTS = [
    { value: '', label: 'Tout' },
    { value: 'evenement', label: 'Événements' },
    { value: 'personnalite', label: 'Personnalités' },
    { value: 'institution', label: 'Institutions' },
];

/** Période d'un événement : celle saisie, sinon celle qui couvre son année. */
const periodFor = (event, periods) => {
    if (event.periode_slug) return periods.find((p) => p.slug === event.periode_slug);
    return periods.find((p) => (p.annee_debut === null || event.annee_debut >= p.annee_debut)
        && (p.annee_fin === null || event.annee_debut < p.annee_fin));
};

const RdcChronologiePage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const filters = readSearchParams(searchParams, FILTER_KEYS);
    const key = searchParams.toString();
    const { data, loading, error, retry } = useRdcData((options) => encyclopedieAPI.chronologie(filters, options), [key]);

    const update = (changes) => {
        const next = new URLSearchParams(searchParams);
        Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
        setSearchParams(next);
    };

    const periods = useMemo(() => data?.periodes || [], [data]);
    const groups = useMemo(() => {
        const result = new Map();
        (data?.evenements || []).forEach((event) => {
            const period = periodFor(event, periods);
            const groupKey = period?.slug || 'autres';
            if (!result.has(groupKey)) result.set(groupKey, { period, years: new Map() });
            const years = result.get(groupKey).years;
            if (!years.has(event.annee_debut)) years.set(event.annee_debut, []);
            years.get(event.annee_debut).push(event);
        });
        return [...result.values()];
    }, [data, periods]);

    // Frise proportionnelle des périodes (bornes ouvertes ramenées à des valeurs lisibles).
    const band = useMemo(() => {
        const thisYear = new Date().getFullYear();
        const dated = periods.filter((p) => p.annee_debut !== null || p.annee_fin !== null);
        if (dated.length === 0) return [];
        const starts = dated.map((p) => (p.annee_debut ?? (p.annee_fin - 60)));
        const min = Math.min(...starts);
        const max = thisYear;
        return dated.map((p) => {
            const start = p.annee_debut ?? (p.annee_fin - 60);
            const end = p.annee_fin ?? thisYear;
            return { ...p, width: Math.max(((end - start) / (max - min)) * 100, 6) };
        });
    }, [periods]);

    const activePeriod = periods.find((p) => p.slug === filters.periode);

    return (
        <RdcLayout title="Chronologie" breadcrumb={[{ label: 'Mon pays', to: '/rdc' }, { label: 'Chronologie' }]}>
            <PageBanner
                color="#7c2d12"
                icon={LuClock}
                eyebrow="Histoire"
                title="Chronologie de l’histoire de la RDC"
                description="Périodes, régimes politiques, événements majeurs et personnalités, des sociétés précoloniales à nos jours."
                chips={[data ? `${data.count} entrées datées` : null, `${periods.length || 7} périodes`]}
                compact
            />

            {band.length > 0 && (
                <div className="rdc-timeline-band" role="group" aria-label="Filtrer par période">
                    {band.map((p) => (
                        <button
                            key={p.slug}
                            type="button"
                            className={filters.periode === p.slug ? 'active' : ''}
                            style={{ flexGrow: p.width, '--rdc-accent': p.couleur }}
                            onClick={() => update({ periode: filters.periode === p.slug ? '' : p.slug })}
                            aria-pressed={filters.periode === p.slug}
                            title={`${p.nom} (${p.libelle_dates})`}
                        >
                            <strong>{p.nom}</strong>
                            <span>{p.libelle_dates}</span>
                        </button>
                    ))}
                </div>
            )}

            <div className="rdc-chips" role="group" aria-label="Type d’entrée">
                {NATURE_SHORTCUTS.map((n) => (
                    <button key={n.value || 'all'} type="button" className={`rdc-chip-button ${(filters.nature || '') === n.value ? 'active' : ''}`} onClick={() => update({ nature: n.value })}>
                        {n.label}
                    </button>
                ))}
                {(filters.categorie || filters.province || filters.q) && (
                    <button type="button" className="rdc-chip-button" onClick={() => update({ categorie: '', province: '', q: '' })}>
                        <LuX size={13} /> Retirer les autres filtres
                    </button>
                )}
            </div>

            {activePeriod?.resume && (
                <div className="rdc-period-intro" style={{ '--rdc-accent': activePeriod.couleur }}>
                    <h2>{activePeriod.nom} <span>{activePeriod.libelle_dates}</span></h2>
                    <p>{activePeriod.resume}</p>
                </div>
            )}

            {loading && !data && <RdcLoading variant="detail" />}
            {error && !data && <RdcError error={error} onRetry={retry} />}
            {data && data.evenements.length === 0 && (
                <RdcEmpty icon={LuCalendar} title="Aucun élément daté" message="Les fiches datées apparaîtront ici dès leur publication." />
            )}
            {data?.tronque && <p className="rdc-note">Affichage des {data.evenements.length} premiers éléments sur {data.count} : choisissez une période pour tout voir.</p>}

            <div className={`rdc-timeline ${loading ? 'is-refreshing' : ''}`}>
                {groups.map(({ period, years }) => (
                    <section key={period?.slug || 'autres'} className="rdc-timeline-period" style={{ '--rdc-accent': period?.couleur || '#64748b' }}>
                        <h2 className="rdc-timeline-period-title">
                            {period ? period.nom : 'Autres dates'}
                            {period && <span>{period.libelle_dates}</span>}
                        </h2>
                        <ol>
                            {[...years.entries()].map(([year, events]) => (
                                <li key={year} className="rdc-timeline-year">
                                    <span className="rdc-timeline-year-label">{formatYear(year)}</span>
                                    <ul>
                                        {events.map((event) => {
                                            const Icon = event.nature === 'personnalite' ? LuUser : categoryIcon(event.categorie?.icone);
                                            const image = mediaUrl(event.image);
                                            return (
                                                <li key={event.id}>
                                                    <Link to={`/rdc/fiche/${event.slug}`} className="rdc-timeline-item">
                                                        {image && <img src={image} alt="" loading="lazy" />}
                                                        <div>
                                                            <span className="rdc-timeline-meta">
                                                                <Icon size={13} aria-hidden="true" /> {event.nature_label}
                                                                {event.libelle_dates && event.libelle_dates !== String(year) && <> · {event.libelle_dates}</>}
                                                            </span>
                                                            <strong>{event.titre}</strong>
                                                            {event.resume && <p>{event.resume}</p>}
                                                            {event.provinces.length > 0 && (
                                                                <span className="rdc-card-place"><LuMapPin size={12} aria-hidden="true" /> {event.provinces.map((p) => p.nom).join(', ')}</span>
                                                            )}
                                                        </div>
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </li>
                            ))}
                        </ol>
                    </section>
                ))}
            </div>
        </RdcLayout>
    );
};

export default RdcChronologiePage;
