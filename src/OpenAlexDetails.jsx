import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    FaArrowLeft,
    FaBook,
    FaBuilding,
    FaCalendar,
    FaExclamationTriangle,
    FaExternalLinkAlt,
    FaEye,
    FaFileAlt,
    FaFilePdf,
    FaFolder,
    FaGlobe,
    FaLanguage,
    FaLink,
    FaLockOpen,
    FaQuoteRight,
    FaTags,
    FaUser
} from 'react-icons/fa';
import AppNavigation from './components/AppNavigation';
import PDFViewer from './components/PDFViewer';
import { OpenAlexTypeIcon } from './components/external/OpenAlexResources';
import {
    fallbackPdfInfo,
    formatOpenAlexAuthors,
    getOpenAlexLanguageLabel,
    getOpenAlexOaStatusLabel,
    getOpenAlexTypeLabel,
    openAlexApi
} from './services/externalSources/openAlexApi';
import { addLocalHistoryItem } from './utils/localHistory';
import './index.css';
import './styles/ExternalSources.css';

const formatLongDate = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Bouton d'accès adapté à `download_method` (section « pdf-info » de l'API). */
const AccessCard = ({ loading, info, onRead }) => {
    if (loading) {
        return <div className="file-card openalex-access-card"><p className="openalex-access-pending">Vérification de la disponibilité du document…</p></div>;
    }
    const method = info?.download_method;
    let content;
    if (method === 'openalex_proxy' && info.openalex_pdf_url) {
        content = {
            icon: <FaFilePdf />,
            iconClass: 'pdf',
            title: 'Document PDF',
            text: info.cached_on_server
                ? 'Disponible dans le lecteur intégré.'
                : 'Lecteur intégré · le premier affichage peut prendre quelques secondes.',
            action: <button type="button" className="file-action-btn file-open-btn" onClick={onRead}><FaEye /> LIRE</button>
        };
    } else if (method === 'external_link' && info.external_pdf_url) {
        content = {
            icon: <FaFileAlt />,
            title: 'PDF chez l’éditeur',
            text: 'Le document s’ouvre sur le site de l’éditeur, dans un nouvel onglet.',
            action: <a className="file-action-btn file-open-btn" href={info.external_pdf_url} target="_blank" rel="noopener noreferrer"><FaExternalLinkAlt /> OUVRIR</a>
        };
    } else if (method === 'landing_page' && info.landing_page_url) {
        content = {
            icon: <FaGlobe />,
            title: 'Page de la publication',
            text: 'Consultable sur le site de l’éditeur, dans un nouvel onglet.',
            action: <a className="file-action-btn file-open-btn" href={info.landing_page_url} target="_blank" rel="noopener noreferrer"><FaExternalLinkAlt /> VOIR</a>
        };
    } else {
        content = {
            icon: <FaFileAlt />,
            iconClass: 'muted',
            title: 'Document non disponible',
            text: 'Aucun accès en ligne n’est connu pour cette publication.',
            action: null
        };
    }
    return (
        <div className="file-card openalex-access-card">
            <div className="file-card-header">
                <div className="file-card-content">
                    <div className={`file-card-icon openalex-access-icon ${content.iconClass || ''}`}>{content.icon}</div>
                    <div className="file-card-details">
                        <h3 className="file-card-title">{content.title}</h3>
                        <p className="openalex-access-text">{content.text}</p>
                        {info?.license && <div className="file-card-badges"><span className="file-format-badge">Licence : {info.license}</span></div>}
                    </div>
                </div>
            </div>
            {content.action && <div className="file-card-actions">{content.action}</div>}
        </div>
    );
};

/** Fiche détaillée d'une publication OpenAlex, avec lecture du PDF dans le lecteur intégré. */
const OpenAlexDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [work, setWork] = useState(() => (location.state?.work?.id === id ? location.state.work : null));
    const [loading, setLoading] = useState(!work);
    const [error, setError] = useState('');
    const [pdfInfo, setPdfInfo] = useState(null);
    const [pdfInfoLoading, setPdfInfoLoading] = useState(true);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [pdfBlob, setPdfBlob] = useState(null);
    const [viewerError, setViewerError] = useState('');
    const [abstractExpanded, setAbstractExpanded] = useState(false);
    const pdfController = useRef(null);

    const returnToPreviousLocation = () => {
        if (window.history.state?.idx > 0) navigate(-1);
        else navigate('/home');
    };

    useEffect(() => {
        const controller = new AbortController();
        setError('');
        setPdfInfoLoading(true);
        const pdfInfoRequest = openAlexApi.getPdfInfo(id, controller.signal).then((data) => data.data).catch(() => null);
        openAlexApi.getWork(id, controller.signal)
            .then((data) => {
                if (!controller.signal.aborted) setWork(data.data);
                return data.data;
            })
            .catch((requestError) => {
                if (controller.signal.aborted) return null;
                // La notice transmise par la liste reste affichée si le détail échoue.
                if (location.state?.work?.id !== id) setError(requestError.message);
                return null;
            })
            .then(async (loadedWork) => {
                const info = await pdfInfoRequest;
                if (controller.signal.aborted) return;
                setPdfInfo(info || fallbackPdfInfo(loadedWork || location.state?.work));
                setPdfInfoLoading(false);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [id, location.state]);

    useEffect(() => {
        if (!work?.id) return;
        addLocalHistoryItem({
            type: 'resource',
            title: work.title || 'Publication consultée',
            description: `Publication OpenAlex consultée · ${getOpenAlexTypeLabel(work.type)}`,
            url: `/ressources/externes/openalex/${work.id}`,
            icon: 'resource',
            metadata: { resourceId: work.id, externalSource: 'OpenAlex' }
        });
    }, [work?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => () => pdfController.current?.abort(), []);

    const openReader = async () => {
        if (!pdfInfo?.openalex_pdf_url) return;
        pdfController.current?.abort();
        const controller = new AbortController();
        pdfController.current = controller;
        setViewerError('');
        setPdfBlob(null);
        setViewerOpen(true);
        try {
            const blob = await openAlexApi.getPdfBlob(pdfInfo.openalex_pdf_url, controller.signal);
            if (!controller.signal.aborted) setPdfBlob(blob);
        } catch (readError) {
            if (controller.signal.aborted) return;
            setViewerOpen(false);
            setViewerError(readError.message || 'Le document n’a pas pu être affiché.');
        }
    };

    const closeReader = () => {
        pdfController.current?.abort();
        setViewerOpen(false);
        setPdfBlob(null);
    };

    if (loading && !work) {
        return (
            <div className="loading-page">
                <AppNavigation />
                <div className="loading-content"><div className="loading-content-placeholder"></div></div>
            </div>
        );
    }

    if (!work) {
        return (
            <div className="error-page">
                <AppNavigation />
                <div className="error-content">
                    <div className="error-icon">❌</div>
                    <h2 className="error-title">Publication introuvable</h2>
                    <p className="error-message">{error}</p>
                    <button onClick={() => navigate('/home')} className="error-btn">Retour aux ressources</button>
                </div>
            </div>
        );
    }

    const authors = formatOpenAlexAuthors(work.authors);
    const institutions = Array.isArray(work.institutions) && work.institutions.length
        ? work.institutions.map((institution) => institution?.name).filter(Boolean)
        : [...new Set((work.authors || []).flatMap((author) => (author.institutions || []).map((institution) => institution?.name)).filter(Boolean))];
    const category = [work.category?.domain?.name, work.category?.field?.name, work.category?.subfield?.name].filter(Boolean).join(' › ');
    const biblio = work.biblio || {};
    const pages = [biblio.first_page, biblio.last_page].filter(Boolean).join('–');
    const biblioLabel = [biblio.volume && `Vol. ${biblio.volume}`, biblio.issue && `n° ${biblio.issue}`, pages && `p. ${pages}`].filter(Boolean).join(', ');
    const oaStatus = work.open_access_details?.oa_status;
    const infoRows = [
        authors && { icon: <FaUser />, label: 'Auteur(s)', value: authors },
        institutions.length > 0 && { icon: <FaBuilding />, label: 'Institution(s)', value: institutions.join(', ') },
        work.publication_source?.name && { icon: <FaBook />, label: 'Source', value: work.publication_source.name, extra: biblioLabel },
        work.publisher && { icon: <FaBuilding />, label: 'Éditeur', value: work.publisher },
        category && { icon: <FaFolder />, label: 'Classement', value: category, extra: work.category?.topic?.name },
        work.keywords?.length > 0 && { icon: <FaTags />, label: 'Mots-clés', value: work.keywords.join(', ') },
        { icon: <OpenAlexTypeIcon type={work.type} />, label: 'Type de document', value: getOpenAlexTypeLabel(work.type) },
        work.language && { icon: <FaLanguage />, label: 'Langue', value: getOpenAlexLanguageLabel(work.language) },
        (work.publication_date || work.publication_year) && {
            icon: <FaCalendar />,
            label: 'Publication',
            value: formatLongDate(work.publication_date) || String(work.publication_year)
        },
        work.doi && { icon: <FaLink />, label: 'DOI', value: work.doi, href: `https://doi.org/${work.doi}` },
        { icon: <FaQuoteRight />, label: 'Citations', value: (work.cited_by_count || 0).toLocaleString('fr-FR') },
        typeof work.open_access === 'boolean' && {
            icon: <FaLockOpen />,
            label: 'Libre accès',
            value: work.open_access ? 'Oui' : 'Non',
            extra: oaStatus ? getOpenAlexOaStatusLabel(oaStatus) : ''
        },
        work.license && { icon: <FaFileAlt />, label: 'Licence', value: work.license }
    ].filter(Boolean);

    return (
        <div className="ressource-details-page">
            <AppNavigation />
            {viewerOpen && (
                <PDFViewer
                    pdfData={pdfBlob}
                    title={work.title || 'Document PDF'}
                    onClose={closeReader}
                    isLoading={!pdfBlob}
                />
            )}
            <div className="ressource-details-main">
                <button type="button" className="ressource-details-back-btn" onClick={returnToPreviousLocation}>
                    <FaArrowLeft aria-hidden="true" />
                    Retour
                </button>
                <div className="ressource-details-title-panel">
                    <span className="openalex-type-label"><OpenAlexTypeIcon type={work.type} aria-hidden="true" /> {getOpenAlexTypeLabel(work.type)}</span>
                    <div className="ressource-details-title-section">
                        <h1 className="ressource-details-title">{work.title || 'Titre non disponible'}</h1>
                    </div>
                    {authors && <p className="ressource-details-subtitle">{authors}</p>}
                    <div className="openalex-detail-badges">
                        <span className="homepage-badge openalex-badge-source">OpenAlex</span>
                        {work.openalex_pdf_available && <span className="homepage-badge openalex-badge-pdf">PDF</span>}
                        {work.open_access === true && <span className="homepage-badge openalex-badge-oa">Libre accès</span>}
                        {work.language && <span className="homepage-badge homepage-badge-language">{getOpenAlexLanguageLabel(work.language)}</span>}
                        {work.publication_year && <span className="homepage-badge homepage-badge-domain">{work.publication_year}</span>}
                    </div>
                </div>

                <div className="ressource-details-grid">
                    <div>
                        {work.is_retracted && (
                            <div className="openalex-retracted" role="alert">
                                <FaExclamationTriangle aria-hidden="true" />
                                <div><strong>Publication rétractée</strong><p>Cette publication a été retirée par son éditeur. Consultez-la avec prudence.</p></div>
                            </div>
                        )}

                        <div className="ressource-details-files">
                            <h2>Accès au document</h2>
                            <div className="ressource-details-files-grid">
                                <AccessCard loading={pdfInfoLoading} info={pdfInfo} onRead={openReader} />
                            </div>
                            {viewerError && (
                                <div className="openalex-viewer-error" role="alert">
                                    <p>{viewerError}</p>
                                    {(pdfInfo?.landing_page_url || pdfInfo?.external_pdf_url) && (
                                        <a href={pdfInfo.landing_page_url || pdfInfo.external_pdf_url} target="_blank" rel="noopener noreferrer">
                                            Consulter la publication sur le site de l’éditeur
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>

                        {work.abstract && (
                            <div className="ressource-details-description">
                                <h2>Résumé</h2>
                                <div className={`ressource-details-description-content openalex-abstract ${abstractExpanded ? 'expanded' : ''}`}>
                                    <p>{work.abstract}</p>
                                </div>
                                {work.abstract.length > 600 && (
                                    <button type="button" className="openalex-abstract-toggle" onClick={() => setAbstractExpanded((value) => !value)}>
                                        {abstractExpanded ? 'Réduire' : 'Lire la suite'}
                                    </button>
                                )}
                            </div>
                        )}

                        <p className="openalex-consultation-note"><FaEye aria-hidden="true" /> Cette plateforme est dédiée à la consultation uniquement.</p>
                        {work.openalex_url && (
                            <p className="openalex-source-link">
                                <a href={work.openalex_url} target="_blank" rel="noopener noreferrer"><FaExternalLinkAlt aria-hidden="true" /> Consulter la notice sur OpenAlex</a>
                            </p>
                        )}
                    </div>

                    <div>
                        <div className="ressource-details-sidebar">
                            <div className="sidebar-header">
                                <h3 className="sidebar-title">Informations détaillées</h3>
                                <span className="sidebar-id-badge">{work.id}</span>
                            </div>
                            <div className="sidebar-content">
                                {infoRows.map(({ icon, label, value, extra, href }) => (
                                    <div className="openalex-info-item" key={label}>
                                        <div className="openalex-info-label">{icon}<span>{label}</span></div>
                                        <p className="openalex-info-value">
                                            {href ? <a href={href} target="_blank" rel="noopener noreferrer">{value}</a> : value}
                                        </p>
                                        {extra && <p className="openalex-info-extra">{extra}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OpenAlexDetails;
