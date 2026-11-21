import React, { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
    LuArrowLeft, LuArrowRight, LuBuilding2, LuClock, LuExternalLink, LuImages, LuInfo, LuLanguages, LuLayers, LuLibrary,
    LuMapPin, LuRuler, LuUsers,
} from 'react-icons/lu';
import RdcLayout from './components/RdcLayout';
import FicheCard from './components/FicheCard';
import MediaGallery from './components/MediaGallery';
import RdcMap from './components/RdcMap';
import { StatTiles } from './components/MpParts';
import { RdcEmpty, RdcError, RdcLoading } from './components/RdcStates';
import useRdcData from './useRdcData';
import { encyclopedieAPI } from '../services/encyclopedieApi';
import { categoryIcon, formatDate, formatNumber, hiRes, sanitizeHtml } from './rdcUtils';

const TEXT_SECTIONS = [
    ['climat', 'Climat'],
    ['relief', 'Relief'],
    ['vegetation', 'Végétation'],
    ['hydrographie', 'Hydrographie'],
    ['economie', 'Principales activités économiques'],
    ['culture', 'Particularités culturelles et linguistiques'],
];

/** Page d'une province : en-tête et chiffres clés, onglets de contenu, carte fixe. */
const RdcProvincePage = () => {
    const { slug } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { data: province, loading, error, retry } = useRdcData((options) => encyclopedieAPI.province(slug, options), [slug]);
    const located = useRdcData((options) => encyclopedieAPI.carte({ province: slug }, options), [slug]);
    const all = useRdcData((options) => encyclopedieAPI.provinces(options), []);
    const html = useMemo(() => sanitizeHtml(province?.description), [province]);

    const features = useMemo(() => {
        const list = [...(located.data?.features || [])];
        (province?.localites || []).forEach((localite) => {
            if (localite.latitude === null || localite.longitude === null || localite.latitude === undefined) return;
            list.push({
                type: 'Feature',
                id: `localite-${localite.id ?? localite.nom}`,
                geometry: { type: 'Point', coordinates: [localite.longitude, localite.latitude] },
                properties: { type_objet: 'localite', titre: localite.nom, categorie: 'Villes et territoires', couleur: '#475569', resume: localite.type_label },
            });
        });
        return list;
    }, [located.data, province]);

    const breadcrumb = [
        { label: 'Mon pays', to: '/rdc' },
        { label: 'Provinces', to: '/rdc/provinces' },
        { label: province?.nom || '…' },
    ];

    if (error && !province) {
        return <RdcLayout title="Province introuvable" breadcrumb={breadcrumb}><RdcError error={error} onRetry={error.status === 404 ? null : retry} /></RdcLayout>;
    }
    if (loading && !province) {
        return <RdcLayout breadcrumb={breadcrumb}><RdcLoading variant="detail" /></RdcLayout>;
    }
    if (!province) return null;

    const image = hiRes(province.image_principale, 900);
    const density = province.population && province.superficie_km2 ? Math.round(province.population / province.superficie_km2) : null;
    const sections = TEXT_SECTIONS.filter(([key]) => province[key]);
    const center = province.latitude !== null ? [province.latitude, province.longitude] : null;
    const villes = province.localites.filter((l) => l.type_label === 'Ville' || l.type === 'ville');
    const fichesCount = province.rubriques.reduce((n, r) => n + r.total, 0);

    const tabs = [
        { id: 'apercu', label: 'Aperçu', icon: LuInfo },
        province.localites.length > 0 && { id: 'localites', label: 'Villes et territoires', icon: LuBuilding2, count: province.localites.length },
        province.rubriques.length > 0 && { id: 'themes', label: 'Par thème', icon: LuLayers, count: fichesCount },
        province.medias.length > 0 && { id: 'galerie', label: 'Galerie', icon: LuImages, count: province.medias.length },
        (province.sources.length > 0 || province.donnees.length > 0) && { id: 'sources', label: 'Données et sources', icon: LuLibrary },
    ].filter(Boolean);
    const tab = tabs.some((t) => t.id === searchParams.get('onglet')) ? searchParams.get('onglet') : 'apercu';
    const setTab = (id) => {
        const next = new URLSearchParams(searchParams);
        if (id === 'apercu') next.delete('onglet'); else next.set('onglet', id);
        setSearchParams(next, { replace: true });
    };

    const ordered = all.data?.results || [];
    const position = ordered.findIndex((p) => p.slug === province.slug);
    const previous = position > 0 ? ordered[position - 1] : null;
    const next = position >= 0 && position < ordered.length - 1 ? ordered[position + 1] : null;

    return (
        <RdcLayout title={province.nom} breadcrumb={breadcrumb}>
            <header className="mp-province-head">
                <div className="mp-province-id">
                    <span className="mp-banner-eyebrow mp-eyebrow-dark">
                        <LuMapPin size={14} aria-hidden="true" /> Province{province.code ? ` · ${province.code}` : ''}
                    </span>
                    <h1>{province.nom}</h1>
                    {province.chef_lieu && <p className="mp-province-capital">Chef-lieu : <strong>{province.chef_lieu}</strong></p>}
                    {province.presentation && <p className="mp-lead mp-lead-plain">{province.presentation}</p>}
                </div>
                <figure className={`mp-province-visual ${image ? '' : 'empty'}`}>
                    {image ? <img src={image} alt={`Situation de la province ${province.nom}`} /> : <span className="mp-province-code">{province.code || province.nom.slice(0, 2)}</span>}
                    {image && province.credit_image && <figcaption>© {province.credit_image}</figcaption>}
                </figure>
            </header>

            <StatTiles items={[
                { icon: LuRuler, label: 'Superficie', value: province.superficie_km2 ? formatNumber(province.superficie_km2) : '—', unit: province.superficie_km2 ? 'km²' : '' },
                { icon: LuUsers, label: province.annee_population ? `Population (${province.annee_population})` : 'Population', value: province.population ? formatNumber(province.population) : '—' },
                { icon: LuUsers, label: 'Densité', value: density ? formatNumber(density) : '—', unit: density ? 'hab./km²' : '' },
                { icon: LuLanguages, label: 'Langues', value: province.langues || null },
                { icon: LuBuilding2, label: 'Villes et territoires', value: province.localites.length || null, hint: villes.length ? `dont ${villes.length} ville${villes.length > 1 ? 's' : ''}` : null },
                { icon: LuLayers, label: 'Fiches liées', value: province.nb_fiches ?? null },
            ]} />

            <nav className="mp-tabs mp-tabs-buttons" role="tablist" aria-label="Contenu de la province">
                {tabs.map((t) => {
                    const TabIcon = t.icon;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            role="tab"
                            aria-selected={tab === t.id}
                            className={`mp-tab ${tab === t.id ? 'active' : ''}`}
                            onClick={() => setTab(t.id)}
                        >
                            <TabIcon size={15} aria-hidden="true" /> {t.label}
                            {t.count ? <span>{formatNumber(t.count)}</span> : null}
                        </button>
                    );
                })}
            </nav>

            <div className="mp-province-grid">
                <div className="mp-province-main" role="tabpanel">
                    {tab === 'apercu' && (
                        <>
                            {html && <div className="mp-block"><div className="rdc-prose mp-prose" dangerouslySetInnerHTML={{ __html: html }} /></div>}
                            {sections.length > 0 && (
                                <div className="mp-text-cards">
                                    {sections.map(([key, label]) => (
                                        <section key={key} className="mp-text-card">
                                            <h2>{label}</h2>
                                            <p>{province[key]}</p>
                                        </section>
                                    ))}
                                </div>
                            )}
                            {!province.presentation && !html && sections.length === 0 && (
                                <RdcEmpty title="Description en cours de rédaction" message="Les informations détaillées de cette province seront ajoutées prochainement." />
                            )}
                            {province.rubriques.length > 0 && (
                                <div className="mp-block">
                                    <h2 className="mp-block-title">Thèmes présents dans la province</h2>
                                    <div className="mp-theme-counts">
                                        {province.rubriques.map((r) => {
                                            const Icon = categoryIcon(r.categorie.icone);
                                            return (
                                                <button key={r.categorie.slug} type="button" className="mp-theme-count" style={{ '--mp-accent': r.categorie.couleur }} onClick={() => setTab('themes')}>
                                                    <span className="mp-theme-icon"><Icon size={16} aria-hidden="true" /></span>
                                                    <span>{r.categorie.nom}</span>
                                                    <strong>{formatNumber(r.total)}</strong>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {tab === 'localites' && (
                        <div className="mp-block">
                            <h2 className="mp-block-title">Villes et territoires</h2>
                            <div className="rdc-table-wrap">
                                <table className="rdc-table">
                                    <thead>
                                        <tr><th scope="col">Nom</th><th scope="col">Type</th><th scope="col">Chef-lieu</th><th scope="col">Population</th><th scope="col">Superficie</th></tr>
                                    </thead>
                                    <tbody>
                                        {province.localites.map((l) => (
                                            <tr key={l.id ?? `${l.nom}-${l.type_label}`}>
                                                <th scope="row">{l.nom}</th>
                                                <td><span className="rdc-chip">{l.type_label}</span></td>
                                                <td>{l.chef_lieu || '—'}</td>
                                                <td>{l.population ? formatNumber(l.population) : '—'}</td>
                                                <td>{l.superficie_km2 ? `${formatNumber(l.superficie_km2)} km²` : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {tab === 'themes' && province.rubriques.map((rubrique) => {
                        const Icon = categoryIcon(rubrique.categorie.icone);
                        return (
                            <section key={rubrique.categorie.slug} className="mp-section mp-section-tight" style={{ '--rdc-accent': rubrique.categorie.couleur, '--mp-accent': rubrique.categorie.couleur }}>
                                <div className="mp-section-head">
                                    <div>
                                        <span className="mp-eyebrow"><Icon size={14} aria-hidden="true" /> {formatNumber(rubrique.total)} fiche{rubrique.total > 1 ? 's' : ''}</span>
                                        <h2>{rubrique.categorie.nom}</h2>
                                    </div>
                                    {rubrique.total > rubrique.fiches.length && (
                                        <Link className="mp-link" to={`/rdc/categorie/${rubrique.categorie.slug}?province=${province.slug}`}>
                                            Les {rubrique.total} fiches <LuArrowRight size={15} aria-hidden="true" />
                                        </Link>
                                    )}
                                </div>
                                <div className="rdc-card-grid">
                                    {rubrique.fiches.map((fiche) => <FicheCard key={fiche.id} fiche={fiche} />)}
                                </div>
                            </section>
                        );
                    })}

                    {tab === 'galerie' && (
                        <div className="mp-block">
                            <h2 className="mp-block-title">Galerie et documents</h2>
                            <MediaGallery medias={province.medias} />
                        </div>
                    )}

                    {tab === 'sources' && (
                        <>
                            {province.donnees.length > 0 && (
                                <div className="mp-block">
                                    <h2 className="mp-block-title">Données statistiques</h2>
                                    <dl className="rdc-facts">
                                        {province.donnees.map((d) => (
                                            <div key={d.id}>
                                                <dt>{d.libelle}</dt>
                                                <dd>{d.valeur}{d.unite ? ` ${d.unite}` : ''}{d.annee && <small> ({d.annee})</small>}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                </div>
                            )}
                            {province.sources.length > 0 && (
                                <div className="mp-block">
                                    <h2 className="mp-block-title">Sources</h2>
                                    <ol className="rdc-sources">
                                        {province.sources.map((s) => (
                                            <li key={s.id}>
                                                {s.type_label && <span className="rdc-chip">{s.type_label}</span>}
                                                <span>{[s.auteurs, s.titre, s.editeur, s.annee, s.note].filter(Boolean).join(', ')}</span>
                                                {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="rdc-link">Consulter <LuExternalLink size={12} aria-hidden="true" /></a>}
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <aside className="mp-province-aside">
                    <section className="mp-panel mp-panel-map">
                        <h2>Carte de la province</h2>
                        <RdcMap features={features} contour={province.contour} center={center} zoom={province.zoom} height={340} />
                        {located.loading && <p className="rdc-note">Chargement des lieux…</p>}
                    </section>
                    {province.date_mise_a_jour && (
                        <p className="rdc-updated"><LuClock size={13} aria-hidden="true" /> Mise à jour le {formatDate(province.date_mise_a_jour)}</p>
                    )}
                </aside>
            </div>

            {(previous || next) && (
                <nav className="mp-prevnext" aria-label="Autres provinces">
                    {previous ? (
                        <Link to={`/rdc/provinces/${previous.slug}`} className="mp-prevnext-link">
                            <LuArrowLeft size={18} aria-hidden="true" />
                            <span><small>Province précédente</small><strong>{previous.nom}</strong></span>
                        </Link>
                    ) : <span />}
                    {next && (
                        <Link to={`/rdc/provinces/${next.slug}`} className="mp-prevnext-link next">
                            <span><small>Province suivante</small><strong>{next.nom}</strong></span>
                            <LuArrowRight size={18} aria-hidden="true" />
                        </Link>
                    )}
                </nav>
            )}
        </RdcLayout>
    );
};

export default RdcProvincePage;
