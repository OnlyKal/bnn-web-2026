import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaSearch, FaTimes } from 'react-icons/fa';
import { halApi } from '../../services/externalSources/halApi';
import PdfCover from '../common/PdfCover';
import '../../styles/ExternalResources.css';

const PAGE_SIZE = 10;
const HAL_DOCUMENT_TYPES = [
    { code: 'ART', label: 'Article scientifique' },
    { code: 'OUV', label: 'Ouvrage' },
    { code: 'THESE', label: 'Thèse' },
    { code: 'HDR', label: 'Habilitation à diriger des recherches' },
    { code: 'COMM', label: 'Communication dans un congrès' },
    { code: 'COUV', label: "Chapitre d'ouvrage" },
    { code: 'REPORT', label: 'Rapport' },
    { code: 'MEM', label: 'Mémoire' }
];
const initialFilters = { q: '', title: '', author: '', keywords: '', year: '', domain: '', language: '', doc_type: '', has_file: true };

const listFrom = (value) => Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
const domainCode = (domain) => typeof domain === 'string' ? domain : domain?.code || domain?.id || domain?.name || domain?.label || '';
const domainName = (domain) => {
    if (typeof domain === 'string') return domain;
    if (domain?.name) return domain.name;
    if (domain?.label) return domain.label.split('/').filter(Boolean).pop();
    return domain?.code || domain?.id || '';
};
const domainLabel = (domain) => typeof domain === 'string' ? domain : domain?.label || domainName(domain);
const formatDomains = (domains) => listFrom(domains).map(domainName).filter(Boolean).join(', ');
const formatAuthors = (authors) => listFrom(authors).join(', ');

const ExternalResources = () => {
    const navigate = useNavigate();
    const [filters, setFilters] = useState(initialFilters);
    const [appliedFilters, setAppliedFilters] = useState(initialFilters);
    const [page, setPage] = useState(1);
    const [ouvrages, setOuvrages] = useState([]);
    const [total, setTotal] = useState(0);
    const [domaines, setDomaines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [domainsLoading, setDomainsLoading] = useState(true);
    const [error, setError] = useState('');
    const [metaLoaded, setMetaLoaded] = useState(false);
    const [domainSearch, setDomainSearch] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        halApi.getMeta(controller.signal)
            .then((data) => {
                const defaults = data.default_filters || {};
                const defaultDocumentType = HAL_DOCUMENT_TYPES.some(({ code }) => code === defaults.doc_type)
                    ? defaults.doc_type
                    : '';
                setFilters((current) => ({
                    ...current,
                    language: defaults.language || current.language,
                    doc_type: defaultDocumentType || current.doc_type,
                    has_file: defaults.submit_type === 'file' ? true : current.has_file
                }));
                setAppliedFilters((current) => ({
                    ...current,
                    language: defaults.language || current.language,
                    doc_type: defaultDocumentType || current.doc_type,
                    has_file: defaults.submit_type === 'file' ? true : current.has_file
                }));
            })
            .catch(() => {})
            .finally(() => {
                if (!controller.signal.aborted) setMetaLoaded(true);
            });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!metaLoaded) return undefined;
        const controller = new AbortController();
        setDomainsLoading(true);
        const params = {
            language: appliedFilters.language === 'all' ? '' : appliedFilters.language,
            doc_type: appliedFilters.doc_type === 'all' ? '' : appliedFilters.doc_type,
            limit: 100
        };
        halApi.getDomaines(params, controller.signal)
            .then((data) => setDomaines(Array.isArray(data.results) ? data.results : []))
            .catch(() => setDomaines([]))
            .finally(() => setDomainsLoading(false));
        return () => controller.abort();
    }, [appliedFilters.language, appliedFilters.doc_type, metaLoaded]);

    useEffect(() => {
        if (!metaLoaded) return undefined;
        const controller = new AbortController();
        setLoading(true);
        setError('');
        const params = {
            ...appliedFilters,
            page,
            page_size: PAGE_SIZE,
            language: appliedFilters.language === 'all' ? '' : appliedFilters.language,
            doc_type: appliedFilters.doc_type === 'all' ? '' : appliedFilters.doc_type,
            has_file: appliedFilters.has_file ? 'true' : 'false'
        };
        halApi.getOuvrages(params, controller.signal)
            .then((data) => {
                setOuvrages(Array.isArray(data.results) ? data.results : []);
                setTotal(Number(data.total) || 0);
            })
            .catch((requestError) => {
                if (!controller.signal.aborted) {
                    setOuvrages([]);
                    setTotal(0);
                    setError(requestError.message || 'Une erreur est survenue pendant le chargement des ouvrages HAL.');
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [appliedFilters, page, metaLoaded]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const visibleDomains = useMemo(() => {
        const term = domainSearch.trim().toLocaleLowerCase('fr');
        if (!term) return domaines;
        return domaines.filter((domain) => `${domainName(domain)} ${domainLabel(domain)} ${domainCode(domain)}`.toLocaleLowerCase('fr').includes(term));
    }, [domainSearch, domaines]);
    const selectDomain = (code) => {
        setFilters((current) => ({ ...current, domain: code }));
        setAppliedFilters((current) => ({ ...current, domain: code }));
        setPage(1);
    };
    const selectDocumentType = (code) => {
        setFilters((current) => ({ ...current, doc_type: code }));
        setAppliedFilters((current) => ({ ...current, doc_type: code }));
        setPage(1);
    };
    const handleSearch = useCallback((event) => {
        event.preventDefault();
        setPage(1);
        setAppliedFilters({
            ...filters,
            q: filters.q.trim(),
            title: filters.title.trim(),
            author: filters.author.trim(),
            keywords: filters.keywords.trim(),
            year: filters.year.trim(),
            domain: filters.domain.trim()
        });
    }, [filters]);

    return (
        <section className="external-resources" aria-labelledby="external-resources-title">
            <div className="external-hal-layout">
                <aside className="homepage-domains-column external-domain-sidebar">
                    <div className="homepage-domains-header">
                        <h2 className="homepage-section-title">Domaines</h2>
                        <p className="homepage-domains-subtitle">Filtrer les ressources HAL</p>
                    </div>
                    <label className="external-domain-search" htmlFor="hal-domain-search">
                        <FaSearch aria-hidden="true" />
                        <input id="hal-domain-search" value={domainSearch} onChange={(event) => setDomainSearch(event.target.value)} placeholder="Rechercher un domaine…" />
                    </label>
                    {domainsLoading && <div className="homepage-domains-loading">{[...Array(4)].map((_, index) => <div key={index} className="homepage-domain-skeleton" />)}</div>}
                    {!domainsLoading && visibleDomains.length === 0 && <div className="homepage-no-domains"><div className="homepage-no-domains-icon">🏷️</div><p>{domaines.length ? 'Aucun domaine ne correspond' : 'Aucun domaine disponible'}</p></div>}
                    {!domainsLoading && domaines.length > 0 && <div className="homepage-domains-list">
                        <button type="button" className={`homepage-domain-item ${!filters.domain ? 'active' : ''}`} onClick={() => selectDomain('')}>
                            <span className="homepage-domain-info"><span className="homepage-domain-name">Tous les domaines</span></span>
                            {!appliedFilters.domain && <span className="homepage-domain-badge">{total}</span>}
                        </button>
                        {visibleDomains.map((domain) => {
                            const code = domainCode(domain);
                            return <button type="button" key={code} title={domainLabel(domain)} className={`homepage-domain-item ${filters.domain === code ? 'active' : ''}`} onClick={() => selectDomain(code)}>
                                <span className="homepage-domain-info"><span className="homepage-domain-name">{domainName(domain)}</span><span className="homepage-domain-description">{domainLabel(domain)}</span></span>
                            </button>;
                        })}
                    </div>}
                </aside>
                <div className="external-hal-content">
            <section className="homepage-search-section external-hal-search">
                <div className="homepage-search-content">
                    <div className="external-hal-search-controls">
                        <form className="homepage-search-container" onSubmit={handleSearch}>
                            <FaSearch className="homepage-search-icon" />
                            <input id="hal-query" className="homepage-search-input" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Rechercher une ressource HAL…" aria-label="Rechercher dans HAL" />
                            {filters.q && <button type="button" className="homepage-search-clear" onClick={() => {
                                const clearedFilters = { ...filters, q: '' };
                                setFilters(clearedFilters);
                                setAppliedFilters({ ...appliedFilters, q: '' });
                                setPage(1);
                            }}                             aria-label="Effacer la recherche"><FaTimes size={14} /></button>}
                        </form>
                    </div>
                    <div className="homepage-search-hint">Recherche dans les publications de HAL</div>
                </div>
            </section>

            <section className="homepage-filters-section external-hal-filters">
                <div className="homepage-filters-content">
                    <details className="external-hal-advanced-filters">
                        <summary>Filtres avancés</summary>
                        <form className="external-filter-grid" onSubmit={handleSearch}>
                            <label>Auteur<input value={filters.author} onChange={(event) => setFilters({ ...filters, author: event.target.value })} placeholder="Nom de l’auteur" /></label>
                            <label>Titre<input value={filters.title} onChange={(event) => setFilters({ ...filters, title: event.target.value })} placeholder="Titre de la publication" /></label>
                            <label>Mot-clé<input value={filters.keywords} onChange={(event) => setFilters({ ...filters, keywords: event.target.value })} placeholder="Mot-clé" /></label>
                            <label>Année<input inputMode="numeric" value={filters.year} onChange={(event) => setFilters({ ...filters, year: event.target.value })} placeholder="Ex. 2024" /></label>
                            <label>Langue<select value={filters.language} onChange={(event) => setFilters({ ...filters, language: event.target.value })}><option value="">Toutes les langues</option><option value="fr">Français</option><option value="en">Anglais</option></select></label>
                            <label className="external-checkbox-label"><input type="checkbox" checked={filters.has_file} onChange={(event) => setFilters({ ...filters, has_file: event.target.checked })} /> Dépôt avec fichier</label>
                            <button className="external-apply-filters" type="submit">Appliquer les filtres</button>
                        </form>
                    </details>
                </div>
            </section>

            <main className="homepage-main-section external-hal-main">
                <div className="homepage-main-content">
                    <div className="homepage-resources-column external-hal-results">
                        <div className="homepage-resources-header">
                            <h2 id="external-resources-title" className="homepage-section-title">Ressources HAL</h2>
                            <div className="homepage-header-buttons">
                                {appliedFilters.doc_type && (
                                    <button
                                        type="button"
                                        className="homepage-clear-domain-filter"
                                        onClick={() => selectDocumentType('')}
                                        title="Voir toutes les ressources"
                                    >
                                        <FaTimes /> Effacer le filtre
                                    </button>
                                )}
                                <span className="external-hal-label">Source : HAL</span>
                                <span>{loading ? 'Recherche…' : `${total.toLocaleString('fr-FR')} résultat${total > 1 ? 's' : ''}`}</span>
                            </div>
                        </div>

                        {loading && <div className="homepage-loading-grid">{[...Array(6)].map((_, index) => <div key={index} className="homepage-loading-card"><div className="homepage-loading-image" /><div className="homepage-loading-content"><div className="homepage-loading-title" /><div className="homepage-loading-subtitle" /><div className="homepage-loading-badges"><div className="homepage-loading-badge" /><div className="homepage-loading-badge" /></div></div></div>)}</div>}
                        {!loading && error && <div className="homepage-no-results external-hal-error" role="alert"><div className="homepage-no-results-icon"><FaSearch /></div><h3 className="homepage-no-results-title">Le chargement a échoué</h3><p className="homepage-no-results-text">{error}</p><button type="button" className="homepage-clear-filter" onClick={() => setAppliedFilters({ ...appliedFilters })}>Réessayer</button></div>}
                        {!loading && !error && ouvrages.length === 0 && <div className="homepage-no-results"><div className="homepage-no-results-icon"><FaSearch /></div><h3 className="homepage-no-results-title">Aucune ressource trouvée</h3><p className="homepage-no-results-text">Aucune ressource HAL ne correspond à ces critères. Modifiez votre recherche ou vos filtres.</p></div>}

                        {!loading && !error && ouvrages.length > 0 && <div className="homepage-resources-grid external-hal-grid">
                            {ouvrages.map((ouvrage) => {
                                return <article className="homepage-resource-card" key={ouvrage.id || ouvrage.hal_id} onClick={() => navigate(`/ressources/externes/hal/${encodeURIComponent(ouvrage.hal_id || ouvrage.id)}`, { state: { externalSource: 'HAL', ressource: ouvrage } })}>
                                    <div className="homepage-resource-image"><PdfCover><div className="homepage-format-icon">HAL</div></PdfCover></div>
                                    <div className="homepage-resource-content">
                                        <h3 className="homepage-resource-title">{ouvrage.title || 'Titre non disponible'}</h3>
                                        {formatDomains(ouvrage.domains) && <div className="homepage-resource-subtitle" title={listFrom(ouvrage.domains).map(domainLabel).join(', ')}>{formatDomains(ouvrage.domains)}</div>}
                                        {formatAuthors(ouvrage.authors) && <div className="external-hal-authors">{formatAuthors(ouvrage.authors)}</div>}
                                        <div className="homepage-resource-badges">
                                            {ouvrage.language && <span className="homepage-badge homepage-badge-language">{ouvrage.language.toUpperCase()}</span>}
                                            {ouvrage.doc_type && <span className="homepage-badge homepage-badge-type">{ouvrage.doc_type}</span>}
                                            {ouvrage.year && <span className="homepage-badge homepage-badge-domain">{ouvrage.year}</span>}
                                        </div>
                                        <div className="homepage-resource-action"><FaEye size={10} /><span>Voir détails</span></div>
                                    </div>
                                </article>;
                            })}
                        </div>}

                        {!loading && !error && ouvrages.length > 0 && totalPages > 1 && <div className="homepage-pagination">
                            <button className={`homepage-pagination-btn ${page <= 1 ? 'disabled' : ''}`} type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>‹</button>
                            <div className="homepage-pagination-info"><span className="pagination-counter">Page {page} / {totalPages}</span></div>
                            <button className={`homepage-pagination-btn ${page >= totalPages ? 'disabled' : ''}`} type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>›</button>
                        </div>}
                    </div>
                </div>
            </main>
                </div>
                <aside className="homepage-domains-column external-domain-sidebar external-type-sidebar">
                    <div className="homepage-domains-header external-language-heading">
                        <h2 className="homepage-section-title">Langue</h2>
                        <p className="homepage-domains-subtitle">Filtrer les ressources HAL</p>
                    </div>
                    <div className="homepage-domains-list external-language-list">
                        {[
                            { code: '', label: 'Toutes les langues' },
                            { code: 'fr', label: 'Français' },
                            { code: 'en', label: 'Anglais' }
                        ].map(({ code, label }) => (
                            <button
                                type="button"
                                key={code || 'all-languages'}
                                className={`homepage-domain-item ${appliedFilters.language === code ? 'active' : ''}`}
                                onClick={() => {
                                    setFilters((current) => ({ ...current, language: code }));
                                    setAppliedFilters((current) => ({ ...current, language: code }));
                                    setPage(1);
                                }}
                                aria-pressed={appliedFilters.language === code}
                            >
                                <span className="homepage-domain-info">
                                    <span className="homepage-domain-name">{label}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                    <div className="homepage-domains-header">
                        <h2 className="homepage-section-title">Types de document</h2>
                        <p className="homepage-domains-subtitle">Filtrer par code HAL</p>
                    </div>
                    <div className="homepage-domains-list">
                        <button
                            type="button"
                            className={`homepage-domain-item ${!appliedFilters.doc_type ? 'active' : ''}`}
                            onClick={() => selectDocumentType('')}
                            aria-pressed={!appliedFilters.doc_type}
                        >
                            <span className="homepage-domain-info">
                                <span className="homepage-domain-name">Tous les types</span>
                            </span>
                        </button>
                        {HAL_DOCUMENT_TYPES.map(({ code, label }) => (
                            <button
                                type="button"
                                key={code}
                                title={label}
                                className={`homepage-domain-item ${appliedFilters.doc_type === code ? 'active' : ''}`}
                                onClick={() => selectDocumentType(code)}
                                aria-pressed={appliedFilters.doc_type === code}
                            >
                                <span className="homepage-domain-info">
                                    <span className="homepage-domain-name">{code}</span>
                                    <span className="homepage-domain-description">{label}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </aside>
            </div>
        </section>
    );
};

export default ExternalResources;
