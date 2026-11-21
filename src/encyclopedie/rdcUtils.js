import {
    LuBookOpen,
    LuCalendar,
    LuDrama,
    LuFileText,
    LuGem,
    LuLandmark,
    LuMap,
    LuTrainFront,
    LuTreePine,
    LuUser,
    LuZap,
} from 'react-icons/lu';
import { getMediaUrl } from '../config';

export const CATEGORY_ICONS = {
    histoire: LuLandmark,
    geographie: LuMap,
    transport: LuTrainFront,
    energie: LuZap,
    nature: LuTreePine,
    ressources: LuGem,
    patrimoine: LuDrama,
    personne: LuUser,
    evenement: LuCalendar,
    document: LuFileText,
};

export const categoryIcon = (key) => CATEGORY_ICONS[key] || LuBookOpen;

export const DRC_CENTER = [-2.88, 23.65];
export const DRC_ZOOM = 5;

const numberFormat = new Intl.NumberFormat('fr-FR');
export const formatNumber = (value) => (value === null || value === undefined || value === '' ? null : numberFormat.format(value));

export const mediaUrl = (path) => getMediaUrl(path);

export const formatDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const formatYear = (year) => {
    if (year === null || year === undefined) return '';
    return year < 0 ? `${Math.abs(year)} av. J.-C.` : String(year);
};

/** Lien d'intégration pour YouTube / Vimeo, sinon null (fichier vidéo direct). */
export const videoEmbedUrl = (url) => {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\.|^m\./, '');
        if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${parsed.pathname.slice(1)}`;
        if (host.endsWith('youtube.com')) {
            if (parsed.pathname.startsWith('/embed/')) return url;
            const id = parsed.searchParams.get('v') || parsed.pathname.split('/shorts/')[1];
            return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
        }
        if (host === 'vimeo.com') {
            const id = parsed.pathname.split('/').filter(Boolean)[0];
            return id ? `https://player.vimeo.com/video/${id}` : null;
        }
        if (host === 'player.vimeo.com') return url;
    } catch {
        return null;
    }
    return null;
};

export const isVideoFile = (url) => /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url || '');
export const isPdf = (url) => /\.pdf(\?.*)?$/i.test(url || '');

/**
 * Nettoie le HTML rédigé dans l'administration (TinyMCE) avant affichage :
 * retire scripts, iframes non vidéo, gestionnaires d'événements et liens javascript:.
 */
export const sanitizeHtml = (html) => {
    if (!html) return '';
    if (typeof window === 'undefined' || !window.DOMParser) return '';
    const doc = new window.DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    doc.querySelectorAll('script, style, object, embed, form, input, button, link, meta').forEach((node) => node.remove());
    doc.querySelectorAll('iframe').forEach((frame) => {
        if (!videoEmbedUrl(frame.getAttribute('src') || '')) frame.remove();
    });
    doc.querySelectorAll('*').forEach((node) => {
        [...node.attributes].forEach((attribute) => {
            const name = attribute.name.toLowerCase();
            const value = attribute.value.trim().toLowerCase();
            if (name.startsWith('on')) node.removeAttribute(attribute.name);
            if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) node.removeAttribute(attribute.name);
        });
        if (node.tagName === 'A') {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer');
        }
        if (node.tagName === 'IMG') {
            node.setAttribute('loading', 'lazy');
            const src = node.getAttribute('src');
            if (src && src.startsWith('/media/')) node.setAttribute('src', getMediaUrl(src));
        }
    });
    return doc.body.firstChild.innerHTML;
};

/** Paramètres de l'URL → objet (sans valeurs vides). */
export const readSearchParams = (searchParams, keys) => Object.fromEntries(
    keys.map((key) => [key, searchParams.get(key) || '']).filter(([, value]) => value)
);

/**
 * Version haute définition d'une image Wikimedia (bandeaux plein format) :
 * Special:FilePath?width=… et vignettes /…/480px-… sont agrandies ; les autres URL sont inchangées.
 */
export const hiRes = (url, width = 1600) => {
    const full = mediaUrl(url);
    if (!full) return null;
    if (/Special:FilePath\//.test(full)) return full.replace(/width=\d+/, `width=${width}`);
    if (/\/thumb\/.+\/\d+px-[^/]+$/.test(full.split('?')[0])) {
        // Wikimedia ne génère les vignettes qu'à des largeurs standard : on prend la première suffisante.
        const standard = [500, 960, 1280, 1920].find((w) => w >= width) || 1920;
        return full.replace(/\/(\d+)px-([^/?]+)/, `/${standard}px-$2`);
    }
    return full;
};

/** Identifiant d'ancre à partir d'un titre (« Notes et références » → « notes-et-references »). */
export const anchorId = (text) => `s-${(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}`;
