import { getCurrentUser } from './auth';

const getStorageKey = () => {
    const user = getCurrentUser();
    const identity = user?.id || user?.user_id || user?.email || user?.username || 'anonymous';
    return `bnnExternalFavorites:v1:${encodeURIComponent(String(identity))}`;
};

export const getExternalFavorites = () => {
    try {
        const favorites = JSON.parse(localStorage.getItem(getStorageKey()) || '[]');
        return Array.isArray(favorites) ? favorites : [];
    } catch (error) {
        console.warn('Favoris externes illisibles:', error.message);
        return [];
    }
};

const saveExternalFavorites = (favorites) => {
    localStorage.setItem(getStorageKey(), JSON.stringify(favorites));
    window.dispatchEvent(new Event('favorites:changed'));
};

export const hasExternalFavorite = (resourceId) => getExternalFavorites()
    .some((favorite) => String(favorite.ressource?.hal_id || favorite.ressource?.id) === String(resourceId));

export const addExternalFavorite = (resource) => {
    const resourceId = resource?.hal_id || resource?.id;
    if (!resourceId) throw new Error('Cette ressource HAL ne possède pas d’identifiant.');
    const favorites = getExternalFavorites();
    if (favorites.some((favorite) => String(favorite.ressource?.hal_id || favorite.ressource?.id) === String(resourceId))) return;
    saveExternalFavorites([
        { id: `HAL:${resourceId}`, externalSource: 'HAL', ressource: resource },
        ...favorites
    ]);
};

export const removeExternalFavorite = (resourceId) => {
    saveExternalFavorites(getExternalFavorites().filter(
        (favorite) => String(favorite.ressource?.hal_id || favorite.ressource?.id) !== String(resourceId)
    ));
};
