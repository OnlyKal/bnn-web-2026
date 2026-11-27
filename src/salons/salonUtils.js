// Fonctions utilitaires du module Salon (format de l'API salon-v2).
import { API_SERVER_URL } from '../config';

export const MAX_RESOURCES = 5;
export const MAX_ATTACHMENTS = 5;
export const MAX_UPLOAD_MB = 20;
export const ACCEPTED_FILES = '.pdf,.epub,.txt,.csv,.rtf,.doc,.docx,.odt,.xls,.xlsx,.ods,.ppt,.pptx,.odp,.zip,.jpg,.jpeg,.png,.gif,.webp';
const ACCEPTED_EXTENSIONS = ACCEPTED_FILES.split(',').map((ext) => ext.slice(1));

export const extractList = (response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.data)) return response.data;
    return [];
};

export const splitLinks = (value) => (value || '')
    .split(/\n|,/)
    .map((link) => link.trim())
    .filter(Boolean);

export const isHttpUrl = (value) => {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
};

/** Vérifie un fichier avant l'envoi (mêmes règles que le serveur). Retourne un message ou null. */
export const checkFile = (file) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) return `« ${file.name} » : format non accepté.`;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `« ${file.name} » dépasse ${MAX_UPLOAD_MB} Mo.`;
    return null;
};

export const isImageFile = (file) => file.type?.startsWith('image/');

export const buildResourcesFormData = (form, formData = new FormData()) => {
    form.fichiers.forEach((file) => formData.append(isImageFile(file) ? 'images' : 'fichiers', file));
    splitLinks(form.liens).forEach((link) => formData.append('liens', link));
    return formData;
};

export const getResourceCount = (form) => form.fichiers.length + splitLinks(form.liens).length;

export const personName = (person) => person?.nom_complet
    || [person?.prenom, person?.nom].filter(Boolean).join(' ')
    || person?.username
    || 'Utilisateur';

/** Initiales sur deux lettres (prénom + nom), pour distinguer les membres d'un coup d'œil. */
export const initials = (person) => {
    const prenom = (person?.prenom || '').trim();
    const nom = (person?.nom || '').trim();
    if (prenom || nom) return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase() || '?';
    const words = personName(person).trim().split(/\s+/).filter(Boolean);
    return (words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : (words[0] || '?').slice(0, 2)).toUpperCase();
};

/** Heure courte pour la liste des salons : « 14:05 », « Hier » ou « 24/11 ». */
export const formatListTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return formatMessageTime(value);
    if (date.toDateString() === yesterday.toDateString()) return 'Hier';
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
};

/** Réactions proposées sur les messages (la même liste que le serveur). */
export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export const formatMessageTime = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

/** Heure d'ouverture d'un salon, affichée à l'heure de Kinshasa : « 26/11/2026 à 12:00 ». */
export const formatOuverture = (value) => {
    if (!value) return '';
    const date = new Date(value);
    const options = { timeZone: 'Africa/Kinshasa' };
    const jour = date.toLocaleDateString('fr-FR', { ...options, day: '2-digit', month: '2-digit', year: 'numeric' });
    const heure = date.toLocaleTimeString('fr-FR', { ...options, hour: '2-digit', minute: '2-digit' });
    return `${jour} à ${heure}`;
};

/** Valeur d'un champ datetime-local (heure locale du navigateur) pour une date ISO. */
export const toLocalInputValue = (value) => {
    if (!value) return '';
    const date = new Date(value);
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** Le salon n'est pas encore ouvert pour cet utilisateur (le créateur entre toujours). */
export const isNotYetOpen = (salon) => !!salon && salon.est_ouvert === false && !salon.est_createur;

export const formatShortDate = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const getDateLabel = (value) => {
    if (!value) return '';
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
    if (date.toDateString() === yesterday.toDateString()) return 'Hier';
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
};

export const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

/** Adresse WebSocket du serveur, déduite de l'URL de l'API. */
export const getSocketUrl = (token) => {
    const base = API_SERVER_URL.replace(/^http/, 'ws').replace(/\/$/, '');
    return `${base}/ws/salons/?token=${encodeURIComponent(token)}`;
};

/** Découpe un texte pour mettre en valeur les mentions @nom. */
export const splitMentions = (text, mentions = []) => {
    if (!text) return [];
    const usernames = new Set(mentions.map((m) => (m.username || '').toLowerCase()));
    return text.split(/(@[\w.+-]+)/g).filter(Boolean).map((part) => ({
        text: part,
        mention: part.startsWith('@') && usernames.has(part.slice(1).replace(/\.$/, '').toLowerCase())
    }));
};

export const SHARE_SOURCES = {
    bnn: { label: 'BNN', path: (id) => `/ressources/${id}` },
    hal: { label: 'HAL', path: (id) => `/ressources/externes/hal/${encodeURIComponent(id)}` },
    openalex: { label: 'OpenAlex', path: (id) => `/ressources/externes/openalex/${encodeURIComponent(id)}` }
};

/** Lien interne vers la fiche d'une ressource partagée (ou son URL externe). */
export const sharedResourceLink = (resource) => {
    const source = SHARE_SOURCES[resource?.source];
    if (source && resource.identifiant) return { internal: true, href: source.path(resource.identifiant) };
    if (resource?.url && isHttpUrl(resource.url)) return { internal: false, href: resource.url };
    return null;
};

export const STATUT_LABELS = {
    membre: 'Membre',
    en_attente: 'Demande en attente',
    invite: 'Invité',
    parti: 'A quitté',
    retire: 'Retiré',
    refuse: 'Refusé'
};

/** Vérifie les ressources ; retourne un message d'erreur ou null. */
export const validateResources = (form, { required = true, existing = 0 } = {}) => {
    const count = getResourceCount(form);
    if (required && count < 1) return 'Ajoutez au moins une ressource : fichier, image ou lien.';
    if (count + existing > MAX_RESOURCES) return `Un salon accepte au maximum ${MAX_RESOURCES} ressources au total.`;
    for (const file of form.fichiers) {
        const error = checkFile(file);
        if (error) return error;
    }
    const badLink = splitLinks(form.liens).find((link) => !isHttpUrl(link));
    if (badLink) return `Lien invalide : ${badLink}. Utilisez une adresse qui commence par http:// ou https://.`;
    return null;
};
