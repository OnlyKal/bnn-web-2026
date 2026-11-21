import React, { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
    LuChevronLeft, LuChevronRight, LuClock, LuLayoutGrid, LuList, LuMap, LuSearch, LuSlidersHorizontal, LuX,
} from 'react-icons/lu';
import RdcLayout from './components/RdcLayout';
import RdcSearchBox from './components/RdcSearchBox';
import FicheCard from './components/FicheCard';
import RdcMap from './components/RdcMap';
import { FicheRow, PageBanner } from './components/MpParts';
import { RdcEmpty, RdcError, RdcLoading } from './components/RdcStates';
import useRdcData from './useRdcData';
import useRdcTree, { findRoot } from './useRdcTree';
import { encyclopedieAPI } from '../services/encyclopedieApi';
import { categoryIcon, formatNumber, readSearchParams } from './rdcUtils';

const FILTER_KEYS = ['q', 'categorie', 'sous', 'province', 'nature', 'periode', 'media', 'annee_min', 'annee_max', 'ordering', 'vedette', 'page'];
const FILTER_LABELS = { province: 'Province', nature: 'Type', periode: 'Période', media: 'Média', annee_min: 'Depuis', annee_max: 'Jusqu’à', categorie: 'Thème', vedette: 'À la une' };
const PAGE_SIZE = 24;
const VIEW_KEY = 'mp-explorer-view';

const flattenCategories = (nodes, depth = 0, acc = []) => {
    nodes.forEach((node) => {
        acc.push({ ...node, depth });
        flattenCategories(node.enfants || [], depth + 1, acc);
    });
    return acc;
};

/**
 * Page d'un thème (ou d'un sous-thème) et exploration globale :
 * bannière, onglets de sous-thèmes, recherche, filtres, vues cartes / liste / carte.
 */
const RdcExplorerPage = () => {
    const { slug } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const [view, setViewState] = useState(() => {
        try { return window.localStorage.getItem(VIEW_KEY) || 'grille'; } catch { return 'grille'; }
    });
    const [filtersOpen, setFiltersOpen] = useState(false);
    const filters = readSearchParams(searchParams, FILTER_KEYS);
    const page = Number(filters.page) || 1;
    const filterKey = searchParams.toString();
    const tree = useRdcTree();

    const setView = (value) => {
        setViewState(value);
        try { window.localStorage.setItem(VIEW_KEY, value); } catch { /* préférence facultative */ }
    };

    const categorieState = useRdcData(
        (options) => (slug ? encyclopedieAPI.categorie(slug, options) : Promise.resolve(null)),
        [slug]
    );
    const facets = useRdcData((options) => encyclopedieAPI.filtres(options), []);
    const categorie = categorieState.data;
    const root = findRoot(tree, slug) || (categorie?.racine ? { ...categorie.racine, enfants: [] } : null);
    const isSub = Boolean(slug && root && root.slug !== slug);

    // Catégorie interrogée : sous-catégorie (ancien paramètre ?sous=), sinon la page courante.
    const queryParams = useMemo(() => {
        const params = { ...filters, categorie: filters.sous || slug || filters.categorie || undefined };
        delete params.sous;
        return params;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterKey, slug]);

    const list = useRdcData(
        (options) => encyclopedieAPI.fiches({ ...queryParams, page, page_size: PAGE_SIZE }, options),
        [filterKey, slug]
    );
    const mapAllowed = !slug || categorie?.afficher_carte || categorie?.racine?.afficher_carte;
    const effectiveView = view === 'carte' && !mapAllowed ? 'grille' : view;
    const map = useRdcData(
        (options) => (effectiveView === 'carte'
            ? encyclopedieAPI.carte({ ...queryParams, page: undefined, ordering: undefined }, options)
            : Promise.resolve(null)),
        [filterKey, slug, effectiveView]
    );

    const update = (changes) => {
        const next = new URLSearchParams(searchParams);
        Object.entries(changes).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') next.delete(key);
            else next.set(key, value);
        });
        if (!('page' in changes)) next.delete('page');
        setSearchParams(next);
    };

    const resetFilters = () => setSearchParams(new URLSearchParams());
    const activeFilters = FILTER_KEYS.filter((key) => !['page', 'ordering', 'q', 'sous'].includes(key) && filters[key]);
    const allCategories = useMemo(() => flattenCategories(facets.data?.categories || []), [facets.data]);

    const labelFor = (key, value) => {
        if (key === 'province') return facets.data?.provinces.find((p) => p.slug === value)?.nom || value;
        if (key === 'nature') return facets.data?.natures.find((n) => n.valeur === value)?.label || value;
        if (key === 'periode') return facets.data?.periodes.find((p) => p.slug === value)?.nom || value;
        if (key === 'media') return facets.data?.medias.find((m) => m.valeur === value)?.label || value;
        if (key === 'categorie') return allCategories.find((c) => c.slug === value)?.nom || value;
        if (key === 'vedette') return 'Oui';
        return value;
    };

    const title = slug ? (categorie?.nom || 'Thème') : (filters.q ? `Recherche : « ${filters.q} »` : 'Explorer');
    const breadcrumb = [
        { label: 'Mon pays', to: '/rdc' },
        ...(slug ? (categorie?.fil_ariane || []).map((c) => ({ label: c.nom, to: `/rdc/categorie/${c.slug}` })) : []),
        { label: slug ? (categorie?.nom || '…') : 'Explorer' },
    ];

    if (slug && categorieState.error && !categorie) {
        return (
            <RdcLayout title="Thème introuvable" breadcrumb={[{ label: 'Mon pays', to: '/rdc' }, { label: 'Thème' }]} active={slug}>
                <RdcError error={categorieState.error} onRetry={categorieState.retry} />
            </RdcLayout>
        );
    }

    const Icon = categoryIcon(categorie?.icone || root?.icone);
    const results = list.data?.results || [];
    const totalPages = list.data?.total_pages || 0;
    const count = list.data?.count;
    const subs = root?.enfants || categorie?.enfants || [];
    const goPage = (value) => { update({ page: value }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

    return (
        <RdcLayout title={title} breadcrumb={breadcrumb} active={slug}>
            {slug ? (
                <PageBanner
                    image={categorie?.image || categorie?.racine?.image}
                    color={categorie?.couleur || root?.couleur}
                    icon={Icon}
                    eyebrow={isSub ? root?.nom : 'Thème'}
                    title={categorie?.nom || '…'}
                    description={categorie?.description || (isSub ? root?.description : '')}
                    chips={[
                        !isSub && subs.length ? `${subs.length} sous-thèmes` : null,
                        count !== undefined ? `${formatNumber(count)} fiche${count > 1 ? 's' : ''}` : null,
                        mapAllowed ? 'Contenus localisés' : null,
                    ]}
                >
                    {(categorie?.afficher_chronologie || categorie?.racine?.afficher_chronologie) && (
                        <Link to={`/rdc/chronologie?categorie=${slug}`} className="mp-btn mp-btn-light">
                            <LuClock size={16} aria-hidden="true" /> Voir sur la chronologie
                        </Link>
                    )}
                    {mapAllowed && (
                        <button type="button" className="mp-btn mp-btn-glass" onClick={() => setView('carte')}>
                            <LuMap size={16} aria-hidden="true" /> Voir sur la carte
                        </button>
                    )}
                </PageBanner>
            ) : (
                <PageBanner
                    color="#053677"
                    icon={LuSearch}
                    eyebrow="Mon pays"
                    title={filters.q ? 'Résultats de recherche' : 'Explorer toutes les fiches'}
                    description="Recherchez et filtrez les fiches par thème, province, période ou type de média."
                    chips={[count !== undefined ? `${formatNumber(count)} fiche${count > 1 ? 's' : ''}` : null]}
                    compact
                />
            )}

            {slug && subs.length > 0 && (
                <nav className="mp-tabs" aria-label="Sous-thèmes">
                    <Link to={`/rdc/categorie/${root.slug}`} className={`mp-tab ${!isSub ? 'active' : ''}`} aria-current={!isSub ? 'page' : undefined}>
                        Vue d’ensemble
                    </Link>
                    {subs.map((sub) => (
                        <Link
                            key={sub.slug}
                            to={`/rdc/categorie/${sub.slug}`}
                            className={`mp-tab ${sub.slug === slug ? 'active' : ''}`}
                            aria-current={sub.slug === slug ? 'page' : undefined}
                        >
                            {sub.nom}
                            {sub.nb_fiches !== null && sub.nb_fiches !== undefined && <span>{sub.nb_fiches}</span>}
                        </Link>
                    ))}
                </nav>
            )}

            {!slug && tree.length > 0 && (
                <nav className="mp-theme-pills" aria-label="Thèmes">
                    {tree.map((theme) => {
                        const ThemeIcon = categoryIcon(theme.icone);
                        const selected = filters.categorie === theme.slug;
                        return (
                            <button
                                key={theme.slug}
                                type="button"
                                className={`mp-theme-pill ${selected ? 'active' : ''}`}
                                style={{ '--mp-accent': theme.couleur }}
                                onClick={() => update({ categorie: selected ? '' : theme.slug })}
                                aria-pressed={selected}
                            >
                                <ThemeIcon size={15} aria-hidden="true" /> {theme.nom}
                            </button>
                        );
                    })}
                </nav>
            )}

            <div className="mp-toolbar">
                <div className="mp-toolbar-search">
                    <RdcSearchBox
                        key={filters.q || ''}
                        initialValue={filters.q || ''}
                        onSubmit={(text) => update({ q: text })}
                        placeholder={slug ? `Rechercher dans « ${categorie?.nom || 'ce thème'} »…` : undefined}
                    />
                </div>
                <div className="mp-toolbar-actions">
                    <button type="button" className={`mp-btn mp-btn-soft ${filtersOpen ? 'active' : ''}`} onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
                        <LuSlidersHorizontal size={16} aria-hidden="true" />
                        Filtres{activeFilters.length > 0 ? ` · ${activeFilters.length}` : ''}
                    </button>
                    <div className="mp-segmented" role="group" aria-label="Mode d’affichage">
                        <button type="button" className={effectiveView === 'grille' ? 'active' : ''} onClick={() => setView('grille')} aria-pressed={effectiveView === 'grille'} title="Cartes">
                            <LuLayoutGrid size={16} aria-hidden="true" /><span>Cartes</span>
                        </button>
                        <button type="button" className={effectiveView === 'liste' ? 'active' : ''} onClick={() => setView('liste')} aria-pressed={effectiveView === 'liste'} title="Liste">
                            <LuList size={16} aria-hidden="true" /><span>Liste</span>
                        </button>
                        {mapAllowed && (
                            <button type="button" className={effectiveView === 'carte' ? 'active' : ''} onClick={() => setView('carte')} aria-pressed={effectiveView === 'carte'} title="Carte">
                                <LuMap size={16} aria-hidden="true" /><span>Carte</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {filtersOpen && facets.data && (
                <div className="rdc-filters mp-filters">
                    {!slug && (
                        <label>
                            <span>Thème</span>
                            <select value={filters.categorie || ''} onChange={(e) => update({ categorie: e.target.value })}>
                                <option value="">Tous les thèmes</option>
                                {allCategories.map((c) => (
                                    <option key={c.slug} value={c.slug}>{`${'  '.repeat(c.depth)}${c.nom}`}</option>
                                ))}
                            </select>
                        </label>
                    )}
                    <label>
                        <span>Province</span>
                        <select value={filters.province || ''} onChange={(e) => update({ province: e.target.value })}>
                            <option value="">Toutes les provinces</option>
                            {facets.data.provinces.map((p) => <option key={p.slug} value={p.slug}>{p.nom}</option>)}
                        </select>
                    </label>
                    <label>
                        <span>Type de fiche</span>
                        <select value={filters.nature || ''} onChange={(e) => update({ nature: e.target.value })}>
                            <option value="">Tous les types</option>
                            {facets.data.natures.map((n) => <option key={n.valeur} value={n.valeur}>{n.label}</option>)}
                        </select>
                    </label>
                    <label>
                        <span>Période</span>
                        <select value={filters.periode || ''} onChange={(e) => update({ periode: e.target.value })}>
                            <option value="">Toutes les périodes</option>
                            {facets.data.periodes.map((p) => <option key={p.slug} value={p.slug}>{p.nom}</option>)}
                        </select>
                    </label>
                    <label>
                        <span>Contient</span>
                        <select value={filters.media || ''} onChange={(e) => update({ media: e.target.value })}>
                            <option value="">Indifférent</option>
                            {facets.data.medias.map((m) => <option key={m.valeur} value={m.valeur}>{m.label}</option>)}
                        </select>
                    </label>
                    <div className="rdc-filter-years">
                        <span>Années</span>
                        <div>
                            <input type="number" inputMode="numeric" placeholder="De" value={filters.annee_min || ''} onChange={(e) => update({ annee_min: e.target.value })} aria-label="Année minimale" />
                            <input type="number" inputMode="numeric" placeholder="À" value={filters.annee_max || ''} onChange={(e) => update({ annee_max: e.target.value })} aria-label="Année maximale" />
                        </div>
                    </div>
                    <label>
                        <span>Trier par</span>
                        <select value={filters.ordering || ''} onChange={(e) => update({ ordering: e.target.value })}>
                            <option value="">{filters.q ? 'Pertinence' : 'Titre (A → Z)'}</option>
                            {facets.data.ordres.filter((o) => o.valeur !== 'titre' || filters.q).map((o) => <option key={o.valeur} value={o.valeur}>{o.label}</option>)}
                        </select>
                    </label>
                </div>
            )}

            {(activeFilters.length > 0 || filters.q) && (
                <div className="mp-active-filters" aria-label="Filtres actifs">
                    {filters.q && (
                        <button type="button" onClick={() => update({ q: '' })}>
                            « {filters.q} » <LuX size={13} aria-label="Retirer" />
                        </button>
                    )}
                    {activeFilters.map((key) => (
                        <button key={key} type="button" onClick={() => update({ [key]: '' })}>
                            {FILTER_LABELS[key] || key} : {labelFor(key, filters[key])} <LuX size={13} aria-label="Retirer" />
                        </button>
                    ))}
                    <button type="button" className="mp-clear" onClick={resetFilters}>Tout effacer</button>
                </div>
            )}

            {list.data && (
                <p className="mp-result-count" aria-live="polite">
                    <strong>{formatNumber(list.data.count)}</strong> fiche{list.data.count > 1 ? 's' : ''}
                    {totalPages > 1 && <> · page {page} sur {totalPages}</>}
                </p>
            )}

            {effectiveView === 'carte' ? (
                <div className="mp-map-panel">
                    {map.error && <RdcError error={map.error} onRetry={map.retry} />}
                    <RdcMap features={map.data?.features || []} height="min(68vh, 620px)" />
                    {map.loading && <div className="rdc-map-loading" role="status">Chargement de la carte…</div>}
                    {map.data && map.data.features.length === 0 && <p className="rdc-note">Aucune fiche localisée ne correspond à ces critères.</p>}
                    {map.data?.tronque && <p className="rdc-note">Affichage limité aux {map.data.features.length} premiers objets : affinez les filtres.</p>}
                </div>
            ) : (
                <>
                    {list.loading && !list.data && <RdcLoading />}
                    {list.error && <RdcError error={list.error} onRetry={list.retry} />}
                    {list.data && results.length === 0 && (
                        <RdcEmpty
                            title="Aucune fiche trouvée"
                            message={activeFilters.length || filters.q ? 'Essayez d’autres mots-clés ou retirez des filtres.' : 'Ce thème sera enrichi prochainement.'}
                        >
                            {(activeFilters.length > 0 || filters.q) && (
                                <button type="button" className="mp-btn" onClick={resetFilters}>Réinitialiser la recherche</button>
                            )}
                        </RdcEmpty>
                    )}
                    {results.length > 0 && effectiveView === 'grille' && (
                        <div className={`rdc-card-grid ${list.loading ? 'is-refreshing' : ''}`}>
                            {results.map((fiche) => <FicheCard key={fiche.id} fiche={fiche} />)}
                        </div>
                    )}
                    {results.length > 0 && effectiveView === 'liste' && (
                        <div className={`mp-rows ${list.loading ? 'is-refreshing' : ''}`}>
                            {results.map((fiche) => <FicheRow key={fiche.id} fiche={fiche} />)}
                        </div>
                    )}
                    {totalPages > 1 && (
                        <nav className="mp-pagination" aria-label="Pagination">
                            <button type="button" className="mp-btn mp-btn-soft" disabled={page <= 1} onClick={() => goPage(page - 1)}>
                                <LuChevronLeft size={16} aria-hidden="true" /> Précédent
                            </button>
                            <span>Page {page} sur {totalPages}</span>
                            <button type="button" className="mp-btn mp-btn-soft" disabled={page >= totalPages} onClick={() => goPage(page + 1)}>
                                Suivant <LuChevronRight size={16} aria-hidden="true" />
                            </button>
                        </nav>
                    )}
                </>
            )}
        </RdcLayout>
    );
};

export default RdcExplorerPage;
