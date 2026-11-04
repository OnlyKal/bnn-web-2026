import { API_SERVER_URL } from '../../config';

// Bibliothèque OpenAlex via le serveur BNN : endpoints publics, sans jeton.
// Le frontend n'appelle jamais api.openalex.org (la clé API reste sur le serveur).
const OPENALEX_API_URL = `${API_SERVER_URL}/api/v1/openalex`;
const REQUEST_TIMEOUT = 25000;
// Le premier affichage d'un PDF peut être long : le serveur le récupère chez OpenAlex.
const PDF_TIMEOUT = 120000;

export const OPENALEX_PAGE_SIZE = 20;

/** Rubriques du catalogue (une route serveur par rubrique). */
export const OPENALEX_CATALOGS = [
    { id: 'all', path: '/search/', type: '', label: 'Tout', description: 'Toutes les publications' },
    { id: 'books', path: '/books/', type: 'book', label: 'Livres', description: 'Ouvrages scientifiques' },
    { id: 'chapters', path: '/book-chapters/', type: 'book-chapter', label: 'Chapitres', description: 'Chapitres de livres' },
    { id: 'articles', path: '/articles/', type: 'article', label: 'Articles', description: 'Articles scientifiques' }
];

/** Niveaux du classement OpenAlex utilisés pour le filtrage par domaine. */
export const OPENALEX_CATEGORY_LEVELS = [
    { key: 'domain', label: 'Domaine', plural: 'Domaines' },
    { key: 'field', label: 'Discipline', plural: 'Disciplines' },
    { key: 'subfield', label: 'Sous-discipline', plural: 'Sous-disciplines' }
];

const DOMAIN_LABELS = { 1: 'Sciences de la vie', 2: 'Sciences sociales', 3: 'Sciences physiques', 4: 'Sciences de la santé' };
const FIELD_LABELS = {
    11: 'Agriculture et sciences biologiques',
    12: 'Arts et sciences humaines',
    13: 'Biochimie, génétique et biologie moléculaire',
    14: 'Gestion, management et comptabilité',
    15: 'Génie chimique',
    16: 'Chimie',
    17: 'Informatique',
    18: 'Sciences de la décision',
    19: 'Sciences de la Terre et des planètes',
    20: 'Économie, économétrie et finance',
    21: 'Énergie',
    22: 'Ingénierie',
    23: 'Sciences de l’environnement',
    24: 'Immunologie et microbiologie',
    25: 'Science des matériaux',
    26: 'Mathématiques',
    27: 'Médecine',
    28: 'Neurosciences',
    29: 'Soins infirmiers',
    30: 'Pharmacologie, toxicologie et pharmacie',
    31: 'Physique et astronomie',
    32: 'Psychologie',
    33: 'Sciences sociales',
    34: 'Médecine vétérinaire',
    35: 'Odontologie',
    36: 'Professions de santé'
};

/** Libellé français d'une catégorie (les sous-disciplines gardent le nom OpenAlex). */
export const getOpenAlexCategoryLabel = ({ level, id, name }) => {
    if (level === 'domain') return DOMAIN_LABELS[id] || name;
    if (level === 'field') return FIELD_LABELS[id] || name;
    return name;
};

export const OPENALEX_SORTS = [
    { value: '', label: 'Par défaut' },
    { value: 'relevance', label: 'Pertinence' },
    { value: 'publication_year', label: 'Plus récents' },
    { value: 'cited_by_count', label: 'Plus cités' }
];

const TYPE_LABELS = {
    book: 'Livre',
    'book-chapter': 'Chapitre de livre',
    article: 'Article',
    review: 'Revue de littérature',
    preprint: 'Prépublication',
    dissertation: 'Thèse',
    report: 'Rapport',
    dataset: 'Jeu de données',
    'conference-paper': 'Communication',
    editorial: 'Éditorial',
    letter: 'Lettre',
    'reference-entry': 'Notice de référence'
};

const LANGUAGE_LABELS = { fr: 'Français', en: 'Anglais', es: 'Espagnol', pt: 'Portugais', de: 'Allemand', it: 'Italien' };

const OA_STATUS_LABELS = {
    gold: 'Or (revue en libre accès)',
    green: 'Vert (dépôt en archive ouverte)',
    hybrid: 'Hybride',
    bronze: 'Bronze (lecture libre)',
    diamond: 'Diamant (sans frais)',
    closed: 'Accès restreint'
};

export const getOpenAlexTypeLabel = (type) => TYPE_LABELS[type] || 'Publication';
export const getOpenAlexLanguageLabel = (code) => (code ? LANGUAGE_LABELS[code.toLowerCase()] || code.toUpperCase() : '');
export const getOpenAlexOaStatusLabel = (status) => OA_STATUS_LABELS[status] || status || '';
export const formatOpenAlexAuthors = (authors) => (Array.isArray(authors) ? authors.map((a) => a?.name).filter(Boolean).join(', ') : '');

/** Message français associé à un code d'erreur du serveur. */
export const getOpenAlexErrorMessage = (code, details, retryAfter) => {
    switch (code) {
        case 'INVALID_PARAMETER':
            return details || 'Un des filtres est invalide. Vérifiez votre saisie.';
        case 'OPENALEX_BAD_REQUEST':
            return 'OpenAlex n’a pas pu traiter cette recherche. Simplifiez-la et réessayez.';
        case 'OPENALEX_NOT_FOUND':
            return 'Cette publication est introuvable sur OpenAlex.';
        case 'PDF_NOT_AVAILABLE':
            return 'Le PDF de cette publication n’est pas disponible sur OpenAlex.';
        case 'RATE_LIMITED':
            return retryAfter
                ? `Trop de requêtes. Réessayez dans ${retryAfter} seconde${retryAfter > 1 ? 's' : ''}.`
                : 'Trop de requêtes. Patientez quelques instants avant de réessayer.';
        case 'OPENALEX_RATE_LIMITED':
            return 'Service momentanément saturé, réessayez plus tard.';
        case 'OPENALEX_TIMEOUT':
            return 'OpenAlex n’a pas répondu à temps. Veuillez réessayer.';
        case 'OPENALEX_NOT_CONFIGURED':
            return 'La bibliothèque OpenAlex n’est pas encore configurée. Veuillez prévenir l’administrateur.';
        default:
            return 'La bibliothèque OpenAlex est momentanément indisponible. Veuillez réessayer.';
    }
};

const errorFromResponse = async (response) => {
    let body = null;
    try {
        body = await response.json();
    } catch {
        body = null;
    }
    const retryAfter = Number.parseInt(response.headers.get('Retry-After') || '', 10) || null;
    const error = new Error(getOpenAlexErrorMessage(body?.error?.code, body?.error?.details, retryAfter));
    error.code = body?.error?.code || null;
    error.status = response.status;
    error.data = body?.data || null;
    return error;
};

const withTimeout = async (url, { signal, timeout, accept }) => {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeout);
    const abortFromCaller = () => controller.abort();
    signal?.addEventListener('abort', abortFromCaller);
    try {
        return await fetch(url, { method: 'GET', headers: { Accept: accept }, signal: controller.signal });
    } catch (error) {
        if (error.name === 'AbortError') {
            if (timedOut) throw new Error(getOpenAlexErrorMessage('OPENALEX_TIMEOUT'));
            throw error; // Annulation par l'appelant (filtre modifié, page quittée)
        }
        if (error instanceof TypeError) {
            throw new Error('Impossible de joindre la bibliothèque OpenAlex. Vérifiez votre connexion et réessayez.');
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', abortFromCaller);
    }
};

const buildUrl = (path, params = {}) => {
    const url = new URL(`${OPENALEX_API_URL}${path}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    });
    return url.toString();
};

const requestOpenAlex = async (path, params, signal) => {
    const response = await withTimeout(buildUrl(path, params), { signal, timeout: REQUEST_TIMEOUT, accept: 'application/json' });
    if (!response.ok) throw await errorFromResponse(response);
    let data;
    try {
        data = await response.json();
    } catch {
        throw new Error(getOpenAlexErrorMessage('OPENALEX_INVALID_RESPONSE'));
    }
    if (data?.success === false) throw new Error(getOpenAlexErrorMessage(data?.error?.code, data?.error?.details));
    return data;
};

// Avec « PDF lisible dans la BNN », la liste passe par le catalogue PDF (/pdfs/),
// seul à accepter le filtrage par domaine ; sinon par la route de la rubrique (/books/…).
const usesPdfCatalog = (filters) => Boolean(filters.has_pdf);

/** Filtres communs à la liste et aux comptes par catégorie. */
const commonParams = (catalog, filters) => {
    const pdfCatalog = usesPdfCatalog(filters);
    return {
        [pdfCatalog || catalog.id === 'all' ? 'q' : 'search']: (filters.search || '').trim(),
        type: pdfCatalog ? catalog.type : '',
        language: filters.language,
        year_from: (filters.year_from || '').trim(),
        year_to: (filters.year_to || '').trim(),
        open_access: filters.open_access ? 'true' : '',
        author: (filters.author || '').trim()
    };
};

const categoryParams = (categories = []) => Object.fromEntries(categories.map(({ level, id }) => [level, id]));

/** Paramètres serveur de la liste à partir des filtres de l'interface. */
export const buildOpenAlexParams = (catalog, filters, page) => {
    const pdfCatalog = usesPdfCatalog(filters);
    // « Pertinence » exige un texte recherché : sinon le tri est ignoré.
    const sort = filters.sort === 'relevance' && !(filters.search || '').trim() ? '' : filters.sort;
    return {
        ...commonParams(catalog, filters),
        ...(pdfCatalog ? categoryParams(filters.categories) : {}),
        // has_pdf est implicite sur /pdfs/ (et has_pdf=false y est refusé).
        has_pdf: filters.has_pdf && !pdfCatalog ? 'true' : '',
        sort,
        order: sort ? 'desc' : '',
        page,
        per_page: OPENALEX_PAGE_SIZE
    };
};

const findCatalog = (catalogId) => OPENALEX_CATALOGS.find(({ id }) => id === catalogId) || OPENALEX_CATALOGS[0];

export const openAlexApi = {
    getWorks: (catalogId, filters, page, signal) => {
        const catalog = findCatalog(catalogId);
        const path = usesPdfCatalog(filters) ? '/pdfs/' : catalog.path;
        return requestOpenAlex(path, buildOpenAlexParams(catalog, filters, page), signal);
    },

    /**
     * Sous-catégories de `parents` (domaines si vide) avec le nombre de PDF de chacune,
     * selon la rubrique et les filtres courants. Les lignes sans catégorie connue sont ignorées.
     */
    getCategories: async (catalogId, filters, parents, signal) => {
        const catalog = findCatalog(catalogId);
        const data = await requestOpenAlex('/pdfs/categories/', {
            ...commonParams(catalog, { ...filters, has_pdf: true }),
            ...categoryParams(parents)
        }, signal);
        const level = data.group || OPENALEX_CATEGORY_LEVELS[Math.min(parents.length, 2)].key;
        return {
            level,
            total: Number(data.total) || 0,
            truncated: Boolean(data.truncated),
            items: (Array.isArray(data.results) ? data.results : [])
                .filter((row) => row?.id && row?.name)
                .map((row) => ({ level, id: String(row.id), name: row.name, count: Number(row.count) || 0 }))
        };
    },
    /** Nombre total de publications avec PDF (catalogue `/pdfs/` sans filtre). */
    getTotalCount: async (signal) => {
        const data = await requestOpenAlex('/pdfs/', { page: 1, per_page: 1 }, signal);
        return Number(data?.pagination?.total) || 0;
    },
    getWork: (id, signal) => requestOpenAlex(`/works/${encodeURIComponent(id)}/`, {}, signal),
    getPdfInfo: (id, signal) => requestOpenAlex(`/works/${encodeURIComponent(id)}/pdf-info/`, {}, signal),

    /** Télécharge le PDF (servi par le serveur BNN) pour le lecteur intégré. */
    getPdfBlob: async (pdfUrl, signal) => {
        const response = await withTimeout(pdfUrl, { signal, timeout: PDF_TIMEOUT, accept: 'application/pdf' });
        if (!response.ok) throw await errorFromResponse(response);
        const blob = await response.blob();
        const header = await blob.slice(0, 5).text();
        if (blob.size === 0 || !header.startsWith('%PDF')) {
            throw new Error('Le fichier reçu n’est pas un PDF valide.');
        }
        return blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
    }
};

/** Mode d'accès au document, déduit de la notice si `/pdf-info/` ne répond pas. */
export const fallbackPdfInfo = (work) => {
    if (!work) return null;
    let method = 'unavailable';
    if (work.openalex_pdf_available && work.openalex_pdf_url) method = 'openalex_proxy';
    else if (work.external_pdf_url) method = 'external_link';
    else if (work.landing_page_url) method = 'landing_page';
    return {
        download_method: method,
        openalex_pdf_url: work.openalex_pdf_url,
        external_pdf_url: work.external_pdf_url,
        landing_page_url: work.landing_page_url,
        license: work.license,
        cached_on_server: false
    };
};
