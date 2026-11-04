import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBook, FaBookmark, FaChevronRight, FaEye, FaFileAlt, FaFilePdf, FaLayerGroup, FaNewspaper, FaSearch, FaTimes } from 'react-icons/fa';
import {
    OPENALEX_CATALOGS,
    OPENALEX_CATEGORY_LEVELS,
    OPENALEX_SORTS,
    formatOpenAlexAuthors,
    getOpenAlexCategoryLabel,
    getOpenAlexTypeLabel,
    openAlexApi
} from '../../services/externalSources/openAlexApi';
import { addLocalHistoryItem } from '../../utils/localHistory';
import PdfCover from '../common/PdfCover';
import '../../styles/ExternalResources.css';

const CATALOG_KEY = 'openAlexCatalog';
const LANGUAGES = [
    { code: '', label: 'Toutes les langues' },
    { code: 'fr', label: 'Français' },
    { code: 'en', label: 'Anglais' }
];
const initialFilters = { search: '', author: '', year_from: '', year_to: '', language: '', open_access: false, has_pdf: true, sort: '', categories: [] };

const CATALOG_ICONS = { all: FaLayerGroup, books: FaBook, chapters: FaBookmark, articles: FaNewspaper };

export const OpenAlexTypeIcon = ({ type, ...props }) => {
    if (type === 'book') return <FaBook {...props} />;
    if (type === 'book-chapter') return <FaBookmark {...props} />;
    if (type === 'article' || type === 'review') return <FaNewspaper {...props} />;
    return <FaFileAlt {...props} />;
};

/** Années acceptées par le serveur : 1000 à 2100, début ≤ fin. */
const validateYears = (from, to) => {
    const invalid = (year) => year && (!/^\d{4}$/.test(year) || Number(year) < 1000 || Number(year) > 2100);
    if (invalid(from) || invalid(to)) return 'Saisissez une année entre 1000 et 2100.';
    if (from && to && Number(from) > Number(to)) return 'L’année de début doit précéder l’année de fin.';
    return '';
};

/** Bibliothèque OpenAlex : livres, chapitres et articles scientifiques. */
const OpenAlexResources = () => {
    const navigate = useNavigate();
    const [catalog, setCatalog] = useState(() => {
        const stored = sessionStorage.getItem(CATALOG_KEY);
        return OPENALEX_CATALOGS.some(({ id }) => id === stored) ? stored : 'books';
    });
    const [filters, setFilters] = useState(initialFilters);
    const [appliedFilters, setAppliedFilters] = useState(initialFilters);
    const [page, setPage] = useState(1);
    const [works, setWorks] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [yearError, setYearError] = useState('');
    const [reloadKey, setReloadKey] = useState(0);
    const [categoryPage, setCategoryPage] = useState(null);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [categoriesError, setCategoriesError] = useState('');

    useEffect(() => {
        sessionStorage.setItem(CATALOG_KEY, catalog);
    }, [catalog]);

    // Une seule requête active : la précédente est annulée quand un filtre change.
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError('');
        openAlexApi.getWorks(catalog, appliedFilters, page, controller.signal)
            .then((data) => {
                setWorks(Array.isArray(data.results) ? data.results : []);
                setPagination(data.pagination || null);
            })
            .catch((requestError) => {
                if (controller.signal.aborted) return;
                setWorks([]);
                setPagination(null);
                setError(requestError.message || 'Une erreur est survenue pendant le chargement des publications OpenAlex.');
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [catalog, appliedFilters, page, reloadKey]);

    // Catégories affichées : enfants du dernier niveau choisi (ou ses sœurs au niveau le plus fin).
    const selectedCategories = appliedFilters.categories;
    const browseParents = useMemo(() => {
        const last = selectedCategories[selectedCategories.length - 1];
        return last?.level === 'subfield' ? selectedCategories.slice(0, -1) : selectedCategories;
    }, [selectedCategories]);
    // Les comptes dépendent de la rubrique et des filtres, mais ni du tri ni de la page.
    const categoriesKey = JSON.stringify({
        catalog,
        search: appliedFilters.search,
        language: appliedFilters.language,
        year_from: appliedFilters.year_from,
        year_to: appliedFilters.year_to,
        open_access: appliedFilters.open_access,
        author: appliedFilters.author,
        parents: browseParents.map(({ level, id }) => `${level}:${id}`)
    });

    useEffect(() => {
        const controller = new AbortController();
        const { catalog: catalogId, parents, ...rest } = JSON.parse(categoriesKey);
        setCategoriesLoading(true);
        setCategoriesError('');
        const parentRefs = parents.map((entry) => {
            const [level, id] = entry.split(':');
            return { level, id };
        });
        openAlexApi.getCategories(catalogId, rest, parentRefs, controller.signal)
            .then((page) => setCategoryPage(page))
            .catch((requestError) => {
                if (controller.signal.aborted) return;
                setCategoryPage(null);
                setCategoriesError(requestError.message || 'Domaines indisponibles.');
            })
            .finally(() => {
                if (!controller.signal.aborted) setCategoriesLoading(false);
            });
        return () => controller.abort();
    }, [categoriesKey, reloadKey]);

    /** Choix d'un domaine : réactive le catalogue PDF, seul à accepter ce filtre côté OpenAlex. */
    const selectCategories = (categories) => {
        const next = { ...appliedFilters, categories, has_pdf: categories.length ? true : appliedFilters.has_pdf };
        setFilters((current) => ({ ...current, categories, has_pdf: next.has_pdf }));
        applyFilters(next);
    };

    const total = Number(pagination?.total) || 0;
    const lastPage = Math.max(1, Number(pagination?.max_accessible_page) || 1);
    const truncated = Number(pagination?.total_pages) > lastPage;

    const applyFilters = (next) => {
        setAppliedFilters(next);
        setPage(1);
    };

    const selectCatalog = (id) => {
        setCatalog(id);
        setPage(1);
    };

    const handleSearch = (event) => {
        event.preventDefault();
        const yearsError = validateYears(filters.year_from.trim(), filters.year_to.trim());
        setYearError(yearsError);
        if (yearsError) return;
        const query = filters.search.trim();
        if (query.length >= 2 && query !== appliedFilters.search) {
            addLocalHistoryItem({
                type: 'search',
                title: query,
                description: 'Recherche effectuée dans OpenAlex',
                url: '/home',
                icon: 'search',
                metadata: { query: `openalex:${query}` }
            });
        }
        applyFilters({ ...filters, search: query, author: filters.author.trim(), year_from: filters.year_from.trim(), year_to: filters.year_to.trim() });
    };

    const updateFilter = (key, value) => {
        // Le domaine n'existe que sur le catalogue PDF : il est retiré si l'on inclut les publications sans PDF.
        const extra = key === 'has_pdf' && !value ? { categories: [] } : {};
        setFilters((current) => ({ ...current, [key]: value, ...extra }));
        applyFilters({ ...appliedFilters, [key]: value, ...extra });
    };

    const activeFilters = [
        selectedCategories.length > 0 && {
            key: 'categories',
            label: selectedCategories.map(getOpenAlexCategoryLabel).join(' › '),
            reset: []
        },
        appliedFilters.author && { key: 'author', label: `Auteur : ${appliedFilters.author}`, reset: '' },
        appliedFilters.year_from && { key: 'year_from', label: `Depuis ${appliedFilters.year_from}`, reset: '' },
        appliedFilters.year_to && { key: 'year_to', label: `Jusqu’à ${appliedFilters.year_to}`, reset: '' },
        appliedFilters.open_access && { key: 'open_access', label: 'Libre accès', reset: false }
    ].filter(Boolean);

    const openWork = (work) => navigate(`/ressources/externes/openalex/${encodeURIComponent(work.id)}`, {
        state: { externalSource: 'OpenAlex', work }
    });

    return (
        <section className="external-resources" aria-labelledby="openalex-resources-title">
            <div className="external-hal-layout">
                <aside className="homepage-domains-column external-domain-sidebar">
                    <div className="homepage-domains-header">
                        <h2 className="homepage-section-title">Rubriques</h2>
                        <p className="homepage-domains-subtitle">Parcourir la bibliothèque OpenAlex</p>
                    </div>
                    <div className="homepage-domains-list">
                        {OPENALEX_CATALOGS.map(({ id, label, description }) => {
                            const Icon = CATALOG_ICONS[id];
                            return (
                                <button
                                    type="button"
                                    key={id}
                                    className={`homepage-domain-item ${catalog === id ? 'active' : ''}`}
                                    onClick={() => selectCatalog(id)}
                                    aria-pressed={catalog === id}
                                >
                                    <span className="homepage-domain-info">
                                        <span className="homepage-domain-name openalex-catalog-name"><Icon aria-hidden="true" /> {label}</span>
                                        <span className="homepage-domain-description">{description}</span>
                                    </span>
                                    {catalog === id && !loading && <span className="homepage-domain-badge">{total.toLocaleString('fr-FR')}</span>}
                                </button>
                            );
                        })}
                    </div>
                    <div className="homepage-domains-header">
                        <h2 className="homepage-section-title">Domaines</h2>
                        <p className="homepage-domains-subtitle">Domaine › discipline › sous-discipline</p>
                    </div>
                    <nav className="openalex-breadcrumb" aria-label="Domaine sélectionné">
                        <button type="button" className={!selectedCategories.length ? 'current' : ''} disabled={!selectedCategories.length} onClick={() => selectCategories([])}>
                            Tous les domaines
                        </button>
                        {selectedCategories.map((category, index) => {
                            const current = index === selectedCategories.length - 1;
                            return (
                                <React.Fragment key={`${category.level}:${category.id}`}>
                                    <FaChevronRight aria-hidden="true" />
                                    <button type="button" className={current ? 'current' : ''} disabled={current} onClick={() => selectCategories(selectedCategories.slice(0, index + 1))}>
                                        {getOpenAlexCategoryLabel(category)}
                                    </button>
                                </React.Fragment>
                            );
                        })}
                    </nav>
                    {!appliedFilters.has_pdf && (
                        <p className="openalex-domain-note">OpenAlex ne propose le filtrage par domaine que pour les publications avec PDF : choisir un domaine réactive « PDF lisible dans la BNN ».</p>
                    )}
                    {categoriesLoading && <div className="homepage-domains-loading">{[...Array(4)].map((_, index) => <div key={index} className="homepage-domain-skeleton" />)}</div>}
                    {!categoriesLoading && categoriesError && (
                        <div className="homepage-no-domains"><p>{categoriesError}</p><button type="button" className="homepage-clear-filter" onClick={() => setReloadKey((key) => key + 1)}>Réessayer</button></div>
                    )}
                    {!categoriesLoading && !categoriesError && !categoryPage?.items.length && (
                        <div className="homepage-no-domains"><p>Aucun domaine pour ces filtres</p></div>
                    )}
                    {!categoriesLoading && !categoriesError && categoryPage?.items.length > 0 && (
                        <div className="homepage-domains-list openalex-domain-list">
                            <p className="openalex-domain-level">
                                {OPENALEX_CATEGORY_LEVELS.find(({ key }) => key === categoryPage.level)?.plural || 'Catégories'}
                                {' · '}{categoryPage.total.toLocaleString('fr-FR')} PDF
                                {categoryPage.level === 'subfield' && ' · noms fournis par OpenAlex'}
                            </p>
                            {categoryPage.items.map((category) => {
                                const active = selectedCategories.some((selected) => selected.level === category.level && selected.id === category.id);
                                return (
                                    <button
                                        type="button"
                                        key={`${category.level}:${category.id}`}
                                        className={`homepage-domain-item ${active ? 'active' : ''}`}
                                        onClick={() => selectCategories([...browseParents, { level: category.level, id: category.id, name: category.name }])}
                                        aria-pressed={active}
                                        title={category.name}
                                    >
                                        <span className="homepage-domain-info">
                                            <span className="homepage-domain-name">{getOpenAlexCategoryLabel(category)}</span>
                                        </span>
                                        <span className="homepage-domain-badge">{category.count.toLocaleString('fr-FR')}</span>
                                    </button>
                                );
                            })}
                            {categoryPage.truncated && <p className="openalex-domain-level">Seules les 200 catégories les plus fournies sont affichées.</p>}
                        </div>
                    )}
                    <div className="homepage-domains-header">
                        <h2 className="homepage-section-title">Accès au document</h2>
                        <p className="homepage-domains-subtitle">Lecture dans la BNN</p>
                    </div>
                    <div className="homepage-domains-list">
                        {[
                            { value: true, label: 'PDF lisible dans la BNN', description: 'Lecteur PDF intégré' },
                            { value: false, label: 'Avec et sans PDF', description: 'Toutes les publications' }
                        ].map(({ value, label, description }) => (
                            <button
                                type="button"
                                key={String(value)}
                                className={`homepage-domain-item ${appliedFilters.has_pdf === value ? 'active' : ''}`}
                                onClick={() => updateFilter('has_pdf', value)}
                                aria-pressed={appliedFilters.has_pdf === value}
                            >
                                <span className="homepage-domain-info">
                                    <span className="homepage-domain-name">{label}</span>
                                    <span className="homepage-domain-description">{description}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </aside>

                <div className="external-hal-content">
                    <section className="homepage-search-section external-hal-search">
                        <div className="homepage-search-content">
                            <div className="external-hal-search-controls">
                                <form className="homepage-search-container" onSubmit={handleSearch}>
                                    <FaSearch className="homepage-search-icon" />
                                    <input
                                        id="openalex-query"
                                        className="homepage-search-input"
                                        value={filters.search}
                                        onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                                        placeholder="Rechercher un titre, un résumé, un mot-clé…"
                                        aria-label="Rechercher dans OpenAlex"
                                    />
                                    {filters.search && (
                                        <button
                                            type="button"
                                            className="homepage-search-clear"
                                            onClick={() => {
                                                setFilters({ ...filters, search: '' });
                                                applyFilters({ ...appliedFilters, search: '' });
                                            }}
                                            aria-label="Effacer la recherche"
                                        >
                                            <FaTimes size={14} />
                                        </button>
                                    )}
                                </form>
                            </div>
                            <div className="homepage-search-hint">Recherche dans les titres, résumés et textes intégraux d’OpenAlex</div>
                        </div>
                    </section>

                    <section className="homepage-filters-section external-hal-filters">
                        <div className="homepage-filters-content">
                            <details className="external-hal-advanced-filters">
                                <summary>Filtres avancés</summary>
                                <form className="external-filter-grid" onSubmit={handleSearch}>
                                    <label>Auteur<input value={filters.author} onChange={(event) => setFilters({ ...filters, author: event.target.value })} placeholder="Nom tel qu’il figure dans la publication" /></label>
                                    <label>Année de début<input inputMode="numeric" maxLength={4} value={filters.year_from} onChange={(event) => setFilters({ ...filters, year_from: event.target.value })} placeholder="Ex. 2000" /></label>
                                    <label>Année de fin<input inputMode="numeric" maxLength={4} value={filters.year_to} onChange={(event) => setFilters({ ...filters, year_to: event.target.value })} placeholder="Ex. 2024" /></label>
                                    <label className="external-checkbox-label"><input type="checkbox" checked={filters.open_access} onChange={(event) => setFilters({ ...filters, open_access: event.target.checked })} /> Libre accès uniquement</label>
                                    {yearError && <small className="openalex-filter-error" role="alert">{yearError}</small>}
                                    <button className="external-apply-filters" type="submit">Appliquer les filtres</button>
                                </form>
                            </details>
                        </div>
                    </section>

                    <main className="homepage-main-section external-hal-main">
                        <div className="homepage-main-content">
                            <div className="homepage-resources-column external-hal-results">
                                <div className="homepage-resources-header">
                                    <h2 id="openalex-resources-title" className="homepage-section-title">
                                        {catalog === 'all' ? 'Bibliothèque OpenAlex' : OPENALEX_CATALOGS.find(({ id }) => id === catalog)?.label}
                                    </h2>
                                    <div className="homepage-header-buttons">
                                        <span className="external-hal-label">Source : OpenAlex</span>
                                        <span>{loading ? 'Recherche…' : `${total.toLocaleString('fr-FR')} résultat${total > 1 ? 's' : ''}`}</span>
                                    </div>
                                </div>

                                {activeFilters.length > 0 && (
                                    <div className="openalex-active-filters">
                                        {activeFilters.map(({ key, label, reset }) => (
                                            <button type="button" key={key} className="openalex-active-filter" onClick={() => (key === 'categories' ? selectCategories([]) : updateFilter(key, reset))} title="Retirer ce filtre">
                                                {label} <FaTimes size={10} aria-hidden="true" />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {loading && <div className="homepage-loading-grid">{[...Array(6)].map((_, index) => <div key={index} className="homepage-loading-card"><div className="homepage-loading-image" /><div className="homepage-loading-content"><div className="homepage-loading-title" /><div className="homepage-loading-subtitle" /><div className="homepage-loading-badges"><div className="homepage-loading-badge" /><div className="homepage-loading-badge" /></div></div></div>)}</div>}
                                {!loading && error && <div className="homepage-no-results external-hal-error" role="alert"><div className="homepage-no-results-icon"><FaSearch /></div><h3 className="homepage-no-results-title">Le chargement a échoué</h3><p className="homepage-no-results-text">{error}</p><button type="button" className="homepage-clear-filter" onClick={() => setReloadKey((key) => key + 1)}>Réessayer</button></div>}
                                {!loading && !error && works.length === 0 && (
                                    <div className="homepage-no-results">
                                        <div className="homepage-no-results-icon"><FaSearch /></div>
                                        <h3 className="homepage-no-results-title">Aucune publication trouvée</h3>
                                        <p className="homepage-no-results-text">
                                            {appliedFilters.has_pdf
                                                ? 'Aucune publication avec PDF lisible ne correspond. Modifiez votre recherche ou incluez les publications sans PDF.'
                                                : 'Aucune publication OpenAlex ne correspond à ces critères. Modifiez votre recherche ou vos filtres.'}
                                        </p>
                                        {appliedFilters.has_pdf && <button type="button" className="homepage-clear-filter" onClick={() => updateFilter('has_pdf', false)}>Inclure les publications sans PDF</button>}
                                    </div>
                                )}

                                {!loading && !error && works.length > 0 && (
                                    <div className="homepage-resources-grid external-hal-grid">
                                        {works.map((work) => {
                                            const authors = formatOpenAlexAuthors(work.authors);
                                            const source = work.publication_source?.name || work.publisher;
                                            return (
                                                <article className="homepage-resource-card" key={work.id} onClick={() => openWork(work)}>
                                                    {work.openalex_pdf_available ? (
                                                        <div className="homepage-resource-image">
                                                            <PdfCover><div className="homepage-format-icon">OA</div></PdfCover>
                                                        </div>
                                                    ) : (
                                                        <div className="homepage-resource-image openalex-cover">
                                                            <OpenAlexTypeIcon type={work.type} className="openalex-cover-icon" aria-hidden="true" />
                                                            <span className="openalex-cover-label">OpenAlex</span>
                                                            <div className="homepage-format-icon">OA</div>
                                                        </div>
                                                    )}
                                                    <div className="homepage-resource-content">
                                                        <span className="openalex-type-label"><OpenAlexTypeIcon type={work.type} aria-hidden="true" /> {getOpenAlexTypeLabel(work.type)}</span>
                                                        <h3 className="homepage-resource-title">{work.title || 'Titre non disponible'}</h3>
                                                        {source && <div className="homepage-resource-subtitle" title={source}>{source}</div>}
                                                        {authors && <div className="external-hal-authors">{authors}</div>}
                                                        <div className="homepage-resource-badges">
                                                            {work.openalex_pdf_available && <span className="homepage-badge openalex-badge-pdf">PDF</span>}
                                                            {work.open_access === true && <span className="homepage-badge openalex-badge-oa">Libre accès</span>}
                                                            {work.language && <span className="homepage-badge homepage-badge-language">{work.language.toUpperCase()}</span>}
                                                            {work.publication_year && <span className="homepage-badge homepage-badge-domain">{work.publication_year}</span>}
                                                        </div>
                                                        <div className="homepage-resource-action"><FaEye size={10} /><span>Voir détails</span></div>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                )}

                                {!loading && !error && works.length > 0 && (pagination?.has_next || pagination?.has_previous) && (
                                    <div className="homepage-pagination">
                                        <button className={`homepage-pagination-btn ${!pagination?.has_previous ? 'disabled' : ''}`} type="button" disabled={!pagination?.has_previous} onClick={() => setPage((current) => current - 1)} aria-label="Page précédente">‹</button>
                                        <div className="homepage-pagination-info"><span className="pagination-counter">Page {page} / {lastPage.toLocaleString('fr-FR')}</span></div>
                                        <button className={`homepage-pagination-btn ${!pagination?.has_next || page >= lastPage ? 'disabled' : ''}`} type="button" disabled={!pagination?.has_next || page >= lastPage} onClick={() => setPage((current) => current + 1)} aria-label="Page suivante">›</button>
                                    </div>
                                )}
                                {!loading && !error && truncated && page >= lastPage && (
                                    <p className="openalex-limit-notice">OpenAlex limite la consultation aux 10 000 premiers résultats. Affinez votre recherche pour voir les autres.</p>
                                )}
                            </div>
                        </div>
                    </main>
                </div>

                <aside className="homepage-domains-column external-domain-sidebar external-type-sidebar">
                    <div className="homepage-domains-header external-language-heading">
                        <h2 className="homepage-section-title">Langue</h2>
                        <p className="homepage-domains-subtitle">Filtrer les publications</p>
                    </div>
                    <div className="homepage-domains-list external-language-list">
                        {LANGUAGES.map(({ code, label }) => (
                            <button
                                type="button"
                                key={code || 'all-languages'}
                                className={`homepage-domain-item ${appliedFilters.language === code ? 'active' : ''}`}
                                onClick={() => updateFilter('language', code)}
                                aria-pressed={appliedFilters.language === code}
                            >
                                <span className="homepage-domain-info"><span className="homepage-domain-name">{label}</span></span>
                            </button>
                        ))}
                    </div>
                    <div className="homepage-domains-header">
                        <h2 className="homepage-section-title">Trier par</h2>
                        <p className="homepage-domains-subtitle">Ordre des résultats</p>
                    </div>
                    <div className="homepage-domains-list">
                        {OPENALEX_SORTS.map(({ value, label }) => (
                            <button
                                type="button"
                                key={value || 'default'}
                                className={`homepage-domain-item ${appliedFilters.sort === value ? 'active' : ''}`}
                                onClick={() => updateFilter('sort', value)}
                                aria-pressed={appliedFilters.sort === value}
                                title={value === 'relevance' ? 'S’applique lorsqu’un texte est recherché' : undefined}
                            >
                                <span className="homepage-domain-info">
                                    <span className="homepage-domain-name">{label}</span>
                                    {value === 'relevance' && <span className="homepage-domain-description">Avec un texte recherché</span>}
                                </span>
                            </button>
                        ))}
                    </div>
                </aside>
            </div>
        </section>
    );
};

export default OpenAlexResources;
