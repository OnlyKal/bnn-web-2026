import { API_SERVER_URL } from '../../config';

const HAL_API_URL = `${API_SERVER_URL}/api/hal`;

const requestHal = async (path, params = {}, signal) => {
    const url = new URL(`${HAL_API_URL}${path}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, String(value));
        }
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const abortFromCaller = () => controller.abort();
    signal?.addEventListener('abort', abortFromCaller);

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal
        });
        let data;
        try {
            data = await response.json();
        } catch {
            throw new Error('Le service HAL a retourné une réponse illisible.');
        }

        if (!response.ok || data?.success === false) {
            throw new Error(data?.error || (response.status === 404
                ? 'Cette ressource HAL est introuvable.'
                : 'Le service HAL est momentanément indisponible.'));
        }
        return data;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('La requête HAL a pris trop de temps. Veuillez réessayer.');
        }
        if (error instanceof TypeError) {
            throw new Error('Impossible de joindre le service HAL. Vérifiez votre connexion et réessayez.');
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', abortFromCaller);
    }
};

export const halApi = {
    getMeta: (signal) => requestHal('/meta/', {}, signal),
    getOuvrages: (params, signal) => requestHal('/ouvrages/', params, signal),
    getOuvrage: (identifier, signal) => requestHal(`/ouvrages/${encodeURIComponent(identifier)}/`, {}, signal),
    getDomaines: (params, signal) => requestHal('/domaines/', params, signal)
};

const toHttpUrl = (candidate) => {
    if (!candidate) return null;
    try {
        const url = new URL(candidate);
        return ['https:', 'http:'].includes(url.protocol) ? url.toString() : null;
    } catch {
        return null;
    }
};

export const getHalDocumentUrl = (ouvrage) => {
    const directUrl = toHttpUrl(ouvrage?.document_url);
    if (directUrl) return directUrl;

    const files = Array.isArray(ouvrage?.files) ? ouvrage.files : [];
    const mainFile = files.find((entry) => entry && typeof entry === 'object' && entry.type === 'main' && entry.url);
    return toHttpUrl(mainFile?.url);
};

export const getHalFileUrl = (ouvrage) => {
    const files = Array.isArray(ouvrage?.files) ? ouvrage.files : [];
    const mainFile = files.find((entry) => entry && typeof entry === 'object' && entry.type === 'main' && entry.url);
    const file = mainFile || files.find((entry) => typeof entry === 'string' || entry?.url);
    return getHalDocumentUrl(ouvrage) || toHttpUrl(typeof file === 'string' ? file : file?.url);
};

export const isPdfFile = (url) => Boolean(url && (url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('format=pdf')));

export const mapHalOuvrageToRessource = (ouvrage) => {
    if (!ouvrage) return null;
    const normalizedFileUrl = Array.isArray(ouvrage.fichiers)
        ? ouvrage.fichiers.map((file) => toHttpUrl(file?.fichier)).find(Boolean)
        : null;
    const documentUrl = getHalDocumentUrl(ouvrage) || normalizedFileUrl;
    const title = ouvrage.title || ouvrage.titre || 'Titre non disponible';
    const authors = ouvrage.authors ?? ouvrage.auteurs ?? '';
    const year = ouvrage.year ?? ouvrage.date_publication;
    const domains = Array.isArray(ouvrage.domains) ? ouvrage.domains : [];
    const domainNames = domains.map((domain) => {
        if (typeof domain === 'string') return domain;
        if (domain?.name) return domain.name;
        if (domain?.label) return domain.label.split('/').filter(Boolean).pop();
        return domain?.code || domain?.id || '';
    }).filter(Boolean);

    return {
        id: ouvrage.id || ouvrage.hal_id,
        titre: title,
        auteurs: Array.isArray(authors) ? authors.join(', ') : authors,
        domaine: { nom: domainNames.join(', ') },
        type: ouvrage.doc_type || ouvrage.type || 'Publication',
        format: documentUrl ? 'pdf' : '',
        langue: ouvrage.language || ouvrage.langue || '',
        date_publication: year ? String(year) : '',
        fichiers: documentUrl ? [{ id: ouvrage.id || ouvrage.hal_id, titre: title || 'Document HAL', fichier: documentUrl, format: 'pdf' }] : [],
        externalSource: 'HAL',
        hal_id: ouvrage.hal_id || '',
        keywords: Array.isArray(ouvrage.keywords) ? ouvrage.keywords : [],
        domains,
        document_url: documentUrl,
        source_url: ouvrage.source_url || ouvrage.detail_url || ''
    };
};
