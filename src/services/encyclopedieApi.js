import axios from 'axios';
import { RDC_API_URL } from '../config';
import { wikiSource } from '../encyclopedie/online/wikiSource';

/**
 * Accès aux contenus de l'encyclopédie RDC.
 *
 * Deux sources possibles, mêmes formes de données :
 * - l'API BNN /api/bnn/rdc/ (contenus gérés dans l'administration Django) ;
 * - la source « en ligne » : Wikidata + Wikipédia (voir encyclopedie/online/).
 *
 * VITE_RDC_SOURCE = 'api' | 'online' | 'auto' (défaut). En mode auto, l'API BNN
 * est sondée une fois ; si elle n'existe pas (404) ou ne répond pas, la source
 * en ligne prend le relais pour toute la session.
 */
const client = axios.create({
    baseURL: RDC_API_URL,
    timeout: 30000,
    headers: { Accept: 'application/json' },
});

const SOURCE = (import.meta.env.VITE_RDC_SOURCE || 'auto').toLowerCase();
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map();
let modePromise = null;

const cleanParams = (params = {}) => Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

const apiError = (error) => {
    const status = error.response?.status;
    const message = status === 404
        ? 'Ce contenu est introuvable ou n’est plus publié.'
        : error.code === 'ECONNABORTED'
            ? 'Le serveur met trop de temps à répondre. Veuillez réessayer.'
            : !error.response
                ? 'Erreur de réseau. Vérifiez votre connexion internet.'
                : 'Le chargement a échoué. Veuillez réessayer.';
    const wrapped = new Error(message);
    wrapped.status = status;
    return wrapped;
};

/** 'api' ou 'online', déterminé une seule fois par session. */
export const resolveSource = () => {
    if (SOURCE === 'api' || SOURCE === 'online') return Promise.resolve(SOURCE);
    if (!modePromise) {
        modePromise = client.get('/accueil/', { timeout: 8000 })
            .then((response) => {
                cache.set('/accueil/?', { data: response.data, time: Date.now() });
                return 'api';
            })
            .catch(() => 'online');
    }
    return modePromise;
};

const get = async (path, params, { cached = false, signal } = {}) => {
    const query = cleanParams(params);
    const key = `${path}?${new URLSearchParams(query).toString()}`;
    if (cached) {
        const hit = cache.get(key);
        if (hit && Date.now() - hit.time < CACHE_TTL) return hit.data;
    }
    try {
        const response = await client.get(path, { params: query, signal });
        if (cached) cache.set(key, { data: response.data, time: Date.now() });
        return response.data;
    } catch (error) {
        if (axios.isCancel(error)) throw error;
        throw apiError(error);
    }
};

export const isAbort = (error) => axios.isCancel(error) || error?.name === 'CanceledError' || error?.name === 'AbortError';

const api = {
    accueil: (options) => get('/accueil/', {}, { cached: true, ...options }),
    categories: (options) => get('/categories/', {}, { cached: true, ...options }),
    categorie: (slug, options) => get(`/categories/${encodeURIComponent(slug)}/`, {}, { cached: true, ...options }),
    filtres: (options) => get('/filtres/', {}, { cached: true, ...options }),
    fiches: (params, options) => get('/fiches/', params, options),
    fiche: (slug, options) => get(`/fiches/${encodeURIComponent(slug)}/`, {}, options),
    provinces: (options) => get('/provinces/', {}, { cached: true, ...options }),
    province: (slug, options) => get(`/provinces/${encodeURIComponent(slug)}/`, {}, options),
    chronologie: (params, options) => get('/chronologie/', params, options),
    carte: (params, options) => get('/carte/', params, options),
    recherche: (q, options) => get('/recherche/', { q }, options),
    medias: (params, options) => get('/medias/', params, options),
};

const online = {
    accueil: (options) => wikiSource.accueil(options),
    categories: (options) => wikiSource.categories(options),
    categorie: (slug, options) => wikiSource.categorie(slug, options),
    filtres: (options) => wikiSource.filtres(options),
    fiches: (params, options) => wikiSource.fiches(cleanParams(params), options),
    fiche: (slug, options) => wikiSource.fiche(slug, options),
    provinces: (options) => wikiSource.provinces(options),
    province: (slug, options) => wikiSource.province(slug, options),
    chronologie: (params, options) => wikiSource.chronologie(cleanParams(params), options),
    carte: (params, options) => wikiSource.carte(cleanParams(params), options),
    recherche: (q, options) => wikiSource.recherche(q, options),
    medias: (params, options) => wikiSource.medias(params, options),
};

/** Même interface que l'API, aiguillée vers la source disponible. */
export const encyclopedieAPI = Object.fromEntries(Object.keys(api).map((name) => [
    name,
    async (...args) => ((await resolveSource()) === 'api' ? api[name](...args) : online[name](...args)),
]));

export default encyclopedieAPI;
