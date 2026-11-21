import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LuCompass, LuLayoutGrid, LuList, LuMapPin, LuRuler, LuSearch, LuTrophy, LuUsers } from 'react-icons/lu';
import RdcLayout from './components/RdcLayout';
import RdcMap from './components/RdcMap';
import { PageBanner, StatTiles } from './components/MpParts';
import { RdcEmpty, RdcError, RdcLoading } from './components/RdcStates';
import useRdcData from './useRdcData';
import { encyclopedieAPI } from '../services/encyclopedieApi';
import { formatNumber, mediaUrl } from './rdcUtils';

const normalize = (text) => (text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const SORTS = [
    { value: 'nom', label: 'Nom (A → Z)' },
    { value: 'population', label: 'Population' },
    { value: 'superficie', label: 'Superficie' },
    { value: 'densite', label: 'Densité' },
];

const densityOf = (p) => (p.population && p.superficie_km2 ? p.population / p.superficie_km2 : null);

const Bar = ({ value, max, label }) => (
    <div className="mp-bar" title={label}>
        <span style={{ width: `${max ? Math.max(4, (value / max) * 100) : 0}%` }} />
    </div>
);

/** Les 26 provinces : synthèse, carte, tri et comparaison. */
const RdcProvincesPage = () => {
    const { data, loading, error, retry } = useRdcData((options) => encyclopedieAPI.provinces(options), []);
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState('nom');
    const [view, setView] = useState('grille');
    const list = useMemo(() => data?.results || [], [data]);

    const provinces = useMemo(() => {
        const q = normalize(query.trim());
        const filtered = q ? list.filter((p) => normalize(p.nom).includes(q) || normalize(p.chef_lieu).includes(q)) : [...list];
        const value = {
            population: (p) => p.population || 0,
            superficie: (p) => p.superficie_km2 || 0,
            densite: (p) => densityOf(p) || 0,
        }[sort];
        return value ? filtered.sort((a, b) => value(b) - value(a)) : filtered.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    }, [list, query, sort]);

    const totals = useMemo(() => {
        const sum = (key) => list.reduce((n, p) => n + (p[key] || 0), 0);
        const top = (fn) => list.reduce((best, p) => (fn(p) > (best ? fn(best) : -1) ? p : best), null);
        return {
            area: sum('superficie_km2'),
            population: sum('population'),
            largest: top((p) => p.superficie_km2 || 0),
            mostPopulated: top((p) => p.population || 0),
            maxPop: Math.max(0, ...list.map((p) => p.population || 0)),
            maxArea: Math.max(0, ...list.map((p) => p.superficie_km2 || 0)),
        };
    }, [list]);

    const features = useMemo(() => provinces
        .filter((p) => p.latitude !== null && p.longitude !== null)
        .map((p) => ({
            type: 'Feature',
            id: `province-${p.slug}`,
            geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
            properties: {
                type_objet: 'province', slug: p.slug, titre: p.nom, couleur: '#053677', image: p.image,
                resume: [p.chef_lieu && `Chef-lieu : ${p.chef_lieu}`, p.population && `${formatNumber(p.population)} hab.`].filter(Boolean).join(' · '),
            },
        })), [provinces]);

    return (
        <RdcLayout title="Provinces" breadcrumb={[{ label: 'Mon pays', to: '/rdc' }, { label: 'Provinces' }]}>
            <PageBanner
                color="#0f766e"
                icon={LuCompass}
                eyebrow="Le territoire"
                title="Les 26 provinces de la RDC"
                description="Organisation administrative, géographie, population, villes et territoires, ressources et patrimoine de chaque province."
                compact
            />

            {loading && !data && <RdcLoading count={9} />}
            {error && !data && <RdcError error={error} onRetry={retry} />}

            {data && (
                <>
                    <StatTiles items={[
                        { icon: LuCompass, label: 'Provinces', value: list.length },
                        { icon: LuRuler, label: 'Superficie cumulée', value: totals.area ? formatNumber(totals.area) : null, unit: 'km²' },
                        { icon: LuUsers, label: 'Population cumulée', value: totals.population ? formatNumber(totals.population) : null },
                        totals.largest?.superficie_km2 && { icon: LuTrophy, label: 'La plus vaste', value: totals.largest.nom, hint: `${formatNumber(totals.largest.superficie_km2)} km²` },
                        totals.mostPopulated?.population && { icon: LuTrophy, label: 'La plus peuplée', value: totals.mostPopulated.nom, hint: `${formatNumber(totals.mostPopulated.population)} hab.` },
                    ]} />

                    <div className="mp-provinces-layout">
                        <div className="mp-provinces-map">
                            <RdcMap features={features} height="min(70vh, 640px)" showLegend={false} />
                        </div>

                        <div className="mp-provinces-list">
                            <div className="mp-toolbar mp-toolbar-compact">
                                <div className="rdc-search mp-toolbar-search">
                                    <form onSubmit={(e) => e.preventDefault()} role="search">
                                        <LuSearch className="rdc-search-icon" size={17} aria-hidden="true" />
                                        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Province ou chef-lieu…" aria-label="Filtrer les provinces" />
                                    </form>
                                </div>
                                <div className="mp-toolbar-actions">
                                    <label className="mp-select">
                                        <span className="rdc-visually-hidden">Trier par</span>
                                        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Trier les provinces">
                                            {SORTS.map((s) => <option key={s.value} value={s.value}>Trier : {s.label}</option>)}
                                        </select>
                                    </label>
                                    <div className="mp-segmented" role="group" aria-label="Affichage">
                                        <button type="button" className={view === 'grille' ? 'active' : ''} onClick={() => setView('grille')} aria-pressed={view === 'grille'} title="Cartes">
                                            <LuLayoutGrid size={16} aria-hidden="true" />
                                        </button>
                                        <button type="button" className={view === 'tableau' ? 'active' : ''} onClick={() => setView('tableau')} aria-pressed={view === 'tableau'} title="Tableau">
                                            <LuList size={16} aria-hidden="true" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <p className="mp-result-count"><strong>{provinces.length}</strong> province{provinces.length > 1 ? 's' : ''}</p>

                            {provinces.length === 0 && <RdcEmpty title="Aucune province" message={`Aucune province ne correspond à « ${query} ».`} />}

                            {provinces.length > 0 && view === 'grille' && (
                                <div className="mp-province-cards">
                                    {provinces.map((province, index) => {
                                        const image = mediaUrl(province.image);
                                        const density = densityOf(province);
                                        return (
                                            <Link key={province.slug} to={`/rdc/provinces/${province.slug}`} className="mp-province-card">
                                                <span className="mp-province-card-media">
                                                    {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <span className="rdc-province-code">{province.code || province.nom.slice(0, 2)}</span>}
                                                    {sort !== 'nom' && <span className="mp-rank">{index + 1}</span>}
                                                </span>
                                                <span className="mp-province-card-body">
                                                    <strong>{province.nom}</strong>
                                                    {province.chef_lieu && <span className="rdc-card-place"><LuMapPin size={12} aria-hidden="true" /> {province.chef_lieu}</span>}
                                                    <span className="mp-province-metrics">
                                                        <span>
                                                            <small>Population{province.annee_population ? ` (${province.annee_population})` : ''}</small>
                                                            <b>{province.population ? formatNumber(province.population) : '—'}</b>
                                                            <Bar value={province.population || 0} max={totals.maxPop} label="Population relative" />
                                                        </span>
                                                        <span>
                                                            <small>Superficie</small>
                                                            <b>{province.superficie_km2 ? `${formatNumber(province.superficie_km2)} km²` : '—'}</b>
                                                            <Bar value={province.superficie_km2 || 0} max={totals.maxArea} label="Superficie relative" />
                                                        </span>
                                                    </span>
                                                    {(density || (province.nb_fiches !== null && province.nb_fiches !== undefined)) && (
                                                        <span className="mp-province-foot">
                                                            {density && <span>{formatNumber(Math.round(density))} hab./km²</span>}
                                                            {province.nb_fiches !== null && province.nb_fiches !== undefined && <span>{formatNumber(province.nb_fiches)} fiches</span>}
                                                        </span>
                                                    )}
                                                </span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}

                            {provinces.length > 0 && view === 'tableau' && (
                                <div className="rdc-table-wrap">
                                    <table className="rdc-table mp-province-table">
                                        <thead>
                                            <tr>
                                                <th scope="col">Province</th>
                                                <th scope="col">Chef-lieu</th>
                                                <th scope="col">Population</th>
                                                <th scope="col">Superficie</th>
                                                <th scope="col">Densité</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {provinces.map((p) => (
                                                <tr key={p.slug}>
                                                    <th scope="row"><Link to={`/rdc/provinces/${p.slug}`}>{p.nom}</Link></th>
                                                    <td>{p.chef_lieu || '—'}</td>
                                                    <td>{p.population ? formatNumber(p.population) : '—'}</td>
                                                    <td>{p.superficie_km2 ? `${formatNumber(p.superficie_km2)} km²` : '—'}</td>
                                                    <td>{densityOf(p) ? `${formatNumber(Math.round(densityOf(p)))} hab./km²` : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </RdcLayout>
    );
};

export default RdcProvincesPage;
