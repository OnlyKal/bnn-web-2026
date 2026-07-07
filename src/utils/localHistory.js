const HISTORY_KEY = 'bnnLocalHistory:v1';
const HISTORY_SEEN_KEY = 'bnnLocalHistorySeenAt:v1';
const MAX_HISTORY_ITEMS = 50;

const normalizeText = (value) => String(value || '').trim();

const createHistoryId = (item) => {
    const key = item.metadata?.resourceId || item.metadata?.salonId || item.metadata?.query || item.url || item.title;
    return `${item.type || 'other'}:${normalizeText(key).toLowerCase()}`;
};

export const getLocalHistory = () => {
    try {
        const rawHistory = localStorage.getItem(HISTORY_KEY);
        const parsedHistory = rawHistory ? JSON.parse(rawHistory) : [];
        return Array.isArray(parsedHistory) ? parsedHistory : [];
    } catch (error) {
        console.warn('Historique local illisible:', error.message);
        return [];
    }
};

const saveLocalHistory = (items) => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
    window.dispatchEvent(new Event('local-history:changed'));
};

export const addLocalHistoryItem = (item) => {
    const now = Date.now();
    const normalizedItem = {
        id: createHistoryId(item),
        type: item.type || 'other',
        title: normalizeText(item.title) || 'Activité',
        description: normalizeText(item.description),
        url: item.url || '',
        icon: item.icon || item.type || 'other',
        timestamp: now,
        metadata: item.metadata || {}
    };

    const existingItems = getLocalHistory();
    const nextItems = [
        normalizedItem,
        ...existingItems.filter((historyItem) => historyItem.id !== normalizedItem.id)
    ];

    saveLocalHistory(nextItems);
    return normalizedItem;
};

export const getUnseenHistoryCount = () => {
    const seenAt = Number(localStorage.getItem(HISTORY_SEEN_KEY) || 0);
    return getLocalHistory().filter((item) => item.timestamp > seenAt).length;
};

export const markLocalHistorySeen = () => {
    localStorage.setItem(HISTORY_SEEN_KEY, Date.now().toString());
    window.dispatchEvent(new Event('local-history:changed'));
};

export const removeLocalHistoryItem = (id) => {
    saveLocalHistory(getLocalHistory().filter((item) => item.id !== id));
};

export const clearLocalHistory = () => {
    saveLocalHistory([]);
    markLocalHistorySeen();
};

export const getHistoryTypeLabel = (type) => {
    const labels = {
        resource: 'Ressources',
        favorite: 'Favoris',
        salon: 'Salons',
        search: 'Recherches',
        page: 'Pages',
        action: 'Autres',
        other: 'Autres'
    };

    return labels[type] || labels.other;
};
