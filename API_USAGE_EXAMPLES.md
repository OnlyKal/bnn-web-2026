# 💻 EXEMPLES D'UTILISATION PRATIQUES

**Référence rapide** pour développeurs  
**Mise à jour**: 11 décembre 2025

---

## 🎯 Quick Start

### 1. Appel API Simple

```javascript
// Cas: Obtenir les favoris
import api from './api';

const getFavorites = async () => {
    try {
        const response = await api.get('/favoris/');
        console.log('Favoris:', response.data);
        return response.data.results || response.data;
    } catch (error) {
        console.error('Erreur:', error.message);
    }
};
```

### 2. Appel avec Cache

```javascript
// Cas: Obtenir les domaines (données stables)
import { cachedApiCall } from './utils/apiCache';
import { domainesAPI } from './api';

const getDomaines = async () => {
    return cachedApiCall(
        'domaines:list',
        () => domainesAPI.getDomaines(),
        15 * 60 * 1000 // 15 min cache
    );
};
```

### 3. Appels Parallèles

```javascript
// Cas: Charger plusieurs données au démarrage
const loadInitialData = async () => {
    try {
        const [users, resources, domains] = await Promise.all([
            api.get('/user/profile/'),
            api.get('/ressource/all/'),
            domainesAPI.getDomaines()
        ]);
        return { users, resources, domains };
    } catch (error) {
        console.error('Erreur chargement initial:', error);
    }
};
```

### 4. Débounce Search

```javascript
// Cas: Recherche utilisateur avec délai
import { debounce } from './utils/debounce';

const handleSearchChange = debounce((query) => {
    console.log('Chercher:', query);
    // API call ici
}, 500); // 500ms délai

<input onChange={(e) => handleSearchChange(e.target.value)} />
```

---

## 📚 EXEMPLES PAR CATÉGORIE

### AUTHENTIFICATION

#### Login
```javascript
import { authAPI } from './api';

const login = async (username, password) => {
    try {
        const response = await authAPI.login({
            username,
            password
        });
        
        // Token auto-saved par frontend
        return response;
    } catch (error) {
        // Message d'erreur standardisé
        alert(error.message); // "Nom d'utilisateur ou mot de passe incorrect."
    }
};
```

#### Register
```javascript
import { authAPI, validators } from './api';

const register = async (userData) => {
    // Validation côté client
    if (!validators.validateEmail(userData.email)) {
        throw new Error('Email invalide');
    }
    
    if (!validators.validatePassword(userData.password)) {
        throw new Error('Mot de passe minimum 4 caractères');
    }
    
    try {
        const response = await authAPI.register(userData);
        return response;
    } catch (error) {
        // Erreurs de validation affichées par champ
        console.error(error.message);
    }
};
```

#### Token Refresh (Automatique!)
```javascript
// Rien à faire! C'est automatique
// Intercepteur détecte 401 et refresh

// Mais si vous voulez force un refresh:
const refreshToken = async () => {
    try {
        const response = await authAPI.refreshToken();
        return response;
    } catch (error) {
        // Redirection vers login auto via intercepteur
    }
};
```

---

### PROFIL UTILISATEUR

#### Obtenir Profil
```javascript
import { userAPI } from './api';
import { cachedApiCall } from './utils/apiCache';

// Sans cache (récupère toujours à jour)
const getProfile = async () => {
    const response = await userAPI.getProfile();
    return response;
};

// Avec cache (5 min TTL)
const getProfileCached = async () => {
    return cachedApiCall(
        'user:profile',
        () => userAPI.getProfile(),
        5 * 60 * 1000
    );
};
```

#### Mettre à Jour Profil
```javascript
import { userAPI } from './api';
import { invalidateCache } from './utils/apiCache';

const updateProfile = async (profileData) => {
    try {
        const response = await userAPI.updateProfile(profileData);
        
        // Invalider le cache profile
        invalidateCache('user:profile');
        
        // Event pour notifier autres composants
        window.dispatchEvent(new CustomEvent('userProfileUpdated', {
            detail: response
        }));
        
        return response;
    } catch (error) {
        console.error('Erreur update:', error.message);
    }
};
```

#### Changer Mot de Passe
```javascript
import { userAPI, validators } from './api';

const changePassword = async (oldPassword, newPassword, confirmPassword) => {
    // Validation
    const validation = validators.validatePasswordChange(
        oldPassword,
        newPassword,
        confirmPassword
    );
    
    if (!validation.isValid) {
        throw new Error(validation.errors.join('\n'));
    }
    
    try {
        const response = await userAPI.changePassword({
            oldPassword,
            newPassword,
            confirmPassword
        });
        return response;
    } catch (error) {
        alert('Erreur: ' + error.message);
    }
};
```

#### Upload Avatar
```javascript
import { userAPI, fileUtils } from './api';
import { invalidateCache } from './utils/apiCache';

const uploadAvatar = async (file) => {
    try {
        // Valider le fichier
        fileUtils.validateImageFile(file);
        
        // Créer FormData
        const formData = new FormData();
        formData.append('avatar', file);
        
        // Upload (timeout 30s pour fichiers)
        const response = await userAPI.updateAvatar(formData);
        
        // Invalider cache et notifier
        invalidateCache('user:profile');
        window.dispatchEvent(new CustomEvent('userAvatarUpdated', {
            detail: response
        }));
        
        return response;
    } catch (error) {
        console.error('Erreur avatar:', error.message);
    }
};
```

---

### RESSOURCES ÉDUCATIVES

#### Lister Ressources (Paginées)
```javascript
import api from './api';
import { cachedApiCall } from './utils/apiCache';

const [resources, setPagination] = useState({
    data: [],
    next: null,
    previous: null
});

// Première page (sans cache car pagination change)
const fetchResources = async (cursorUrl = null) => {
    try {
        let url = '/ressources/';
        
        if (cursorUrl) {
            const urlObj = new URL(cursorUrl);
            const cursor = urlObj.searchParams.get('cursor');
            url = `/ressources/?cursor=${cursor}`;
        }
        
        const response = await api.get(url);
        
        setPagination({
            data: response.data.results?.data || [],
            next: response.data.next,
            previous: response.data.previous
        });
    } catch (error) {
        console.error('Erreur fetch ressources:', error);
    }
};
```

#### Détails Ressource
```javascript
import api from './api';
import { getFileUrl, getMediaUrl } from './config';

const getRessourceDetails = async (ressourceId) => {
    try {
        const response = await api.get(`/ressource/${ressourceId}/`);
        const ressource = response.data.data || response.data;
        
        return {
            ...ressource,
            fileUrl: getFileUrl(ressource.file_path),
            coverUrl: getMediaUrl(ressource.cover_image)
        };
    } catch (error) {
        console.error('Erreur détails:', error);
    }
};
```

#### Types de Ressources (Avec Comptage)
```javascript
import api from './api';
import { cachedApiCall } from './utils/apiCache';

const getResourceTypes = async () => {
    try {
        // Obtenir toutes ressources
        const allResources = await cachedApiCall(
            'resources:all',
            async () => {
                const response = await api.get('/ressource/all/');
                return response.data?.data || response.data?.results || [];
            },
            10 * 60 * 1000
        );
        
        // Compter types
        const typeCounts = {};
        allResources.forEach(resource => {
            const type = (resource.type || 'autre').toLowerCase();
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
        
        // Convertir en array avec labels
        return Object.entries(typeCounts).map(([type, count]) => ({
            type,
            count,
            label: type.charAt(0).toUpperCase() + type.slice(1)
        }));
    } catch (error) {
        console.error('Erreur types:', error);
        return [];
    }
};
```

---

### FAVORIS

#### Ajouter aux Favoris
```javascript
import { favorisAPI } from './api';
import { invalidateCache } from './utils/apiCache';

const addToFavorites = async (ressourceId) => {
    try {
        const response = await favorisAPI.addFavori(ressourceId);
        
        // Invalider cache favoris
        invalidateCache('user:favoris');
        
        return response;
    } catch (error) {
        if (error.message.includes('déjà')) {
            console.log('Déjà en favoris');
        } else {
            throw error;
        }
    }
};
```

#### Lister Favoris
```javascript
import { favorisAPI } from './api';
import { cachedApiCall } from './utils/apiCache';

const getFavorites = async () => {
    return cachedApiCall(
        'user:favoris',
        () => favorisAPI.getFavoris(),
        3 * 60 * 1000 // 3 min (peut changer rapidement)
    );
};
```

#### Vérifier si en Favoris
```javascript
import { favorisAPI } from './api';

const isFavorite = async (ressourceId) => {
    try {
        return await favorisAPI.checkFavori(ressourceId);
    } catch (error) {
        console.warn('Erreur check favori:', error);
        return false; // Fallback
    }
};
```

#### Supprimer des Favoris
```javascript
import { favorisAPI } from './api';
import { invalidateCache } from './utils/apiCache';

const removeFromFavorites = async (ressourceId) => {
    try {
        const response = await favorisAPI.removeFavori(ressourceId);
        
        // Invalider cache
        invalidateCache('user:favoris');
        
        return response;
    } catch (error) {
        console.error('Erreur suppression favori:', error);
    }
};
```

---

### TRACKING (Consultations & Téléchargements)

#### Enregistrer Consultation
```javascript
import api from './api';

const recordConsultation = async (ressourceId) => {
    try {
        // Fait maintenant via api.post('/consultations/')
        const response = await api.post('/consultations/', {
            ressource_id: ressourceId
        });
        
        console.log('Consultation enregistrée');
        return response.data;
    } catch (error) {
        // Non-bloquant si erreur
        console.warn('Consultation enregistrement échoué:', error);
    }
};
```

#### Enregistrer Téléchargement
```javascript
import api from './api';

const recordDownload = async (ressourceId) => {
    try {
        const response = await api.post('/downloads/', {
            ressource_id: ressourceId
        });
        
        console.log('Téléchargement enregistré');
        return response.data;
    } catch (error) {
        // Non-bloquant si erreur
        console.warn('Download enregistrement échoué:', error);
    }
};
```

#### Pattern Complet: Ouvrir + Consulter
```javascript
const handleOpenResource = async (ressourceId, fileUrl) => {
    try {
        // Enregistrer consultation
        await recordConsultation(ressourceId);
        
        // Ouvrir fichier
        const fullUrl = getFileUrl(fileUrl);
        window.open(fullUrl, '_blank');
    } catch (error) {
        console.error('Erreur ouverture:', error);
        alert('Erreur lors de l\'ouverture du fichier');
    }
};
```

#### Pattern Complet: Télécharger + Logger
```javascript
const handleDownloadResource = async (ressourceId, fileUrl, filename) => {
    try {
        // Enregistrer download
        await recordDownload(ressourceId);
        
        // Créer lien de download
        const fullUrl = getFileUrl(fileUrl);
        const link = document.createElement('a');
        link.href = fullUrl;
        link.download = filename || 'ressource';
        
        // Déclencher download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Erreur téléchargement:', error);
        alert('Erreur lors du téléchargement');
    }
};
```

---

### DOMAINES

#### Lister Domaines
```javascript
import { domainesAPI } from './api';
import { cachedApiCall } from './utils/apiCache';

const getDomaines = async () => {
    return cachedApiCall(
        'homepage:domaines',
        () => domainesAPI.getDomaines(),
        15 * 60 * 1000 // 15 min (très stables)
    );
};
```

#### Ressources par Domaine
```javascript
import { domainesAPI } from './api';

const getResourcesByDomain = async (domaineId) => {
    try {
        const response = await domainesAPI.getResourcesByDomain(domaineId);
        return response.results || response.data || [];
    } catch (error) {
        console.error('Erreur ressources domaine:', error);
        return [];
    }
};
```

---

## 🧪 PATTERNS AVANCÉS

### Pattern: Retry avec Backoff Exponentiel

```javascript
import api from './api';

const retryWithBackoff = async (fn, maxRetries = 3, delay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            
            const waitTime = delay * Math.pow(2, i);
            console.log(`Retry dans ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
};

// Usage
const data = await retryWithBackoff(
    () => api.get('/ressources/'),
    3,
    1000
);
```

### Pattern: Cancel Request en Cas de Unmount

```javascript
import { useEffect, useRef } from 'react';
import axios from 'axios';
import api from './api';

function Component() {
    const cancelTokenRef = useRef(null);
    
    useEffect(() => {
        // Créer cancel token
        cancelTokenRef.current = axios.CancelToken.source();
        
        const fetchData = async () => {
            try {
                const response = await api.get('/ressources/', {
                    cancelToken: cancelTokenRef.current.token
                });
                // Handle response
            } catch (error) {
                if (axios.isCancel(error)) {
                    console.log('Request cancelled');
                } else {
                    console.error('Error:', error);
                }
            }
        };
        
        fetchData();
        
        // Cleanup: cancel request on unmount
        return () => {
            if (cancelTokenRef.current) {
                cancelTokenRef.current.cancel('Component unmounted');
            }
        };
    }, []);
    
    return <div>Content</div>;
}
```

### Pattern: Invalidate Cache Après Mutation

```javascript
import { invalidateCache, clearCache } from './utils/apiCache';
import api from './api';

const updateAndInvalidate = async (updateFn, cachesToInvalidate = []) => {
    try {
        // Faire mutation (POST/PUT/DELETE)
        const result = await updateFn();
        
        // Invalider les caches affectés
        cachesToInvalidate.forEach(cacheKey => {
            invalidateCache(cacheKey);
        });
        
        return result;
    } catch (error) {
        console.error('Erreur mutation:', error);
        throw error;
    }
};

// Usage
const addFavorite = (ressourceId) => {
    return updateAndInvalidate(
        () => favorisAPI.addFavori(ressourceId),
        ['user:favoris', 'homepage:allResources']
    );
};
```

---

## 🐛 DEBUGGING TIPS

### Voir les Logs Cache
```javascript
// Dans console
import { getCacheStats } from './utils/apiCache.js';

getCacheStats();
// Output:
// {
//   totalEntries: 3,
//   entries: [
//     { key: 'homepage:domaines', age: 2300, ageSeconds: 2 },
//     { key: 'user:favoris', age: 45000, ageSeconds: 45 },
//     { key: 'user:profile', age: 123000, ageSeconds: 123 }
//   ]
// }
```

### Monitorer Requêtes API
```javascript
// Browser DevTools → Network tab
// Filters: XHR
// Voir:
// - Request headers (Authorization: Bearer ...)
// - Response status (200, 401, 404, etc)
// - Response time
// - Size (avec/sans gzip)
```

### Force Refresh Cache
```javascript
import { invalidateCache } from './utils/apiCache.js';

// Invalider un seul cache
invalidateCache('homepage:domaines');

// Invalider tous les caches
import { clearCache } from './utils/apiCache.js';
clearCache();

// Recharger donnée
await fetchDomaines(); // Ira faire requête API
```

---

## 📖 RESSOURCES SUPPLÉMENTAIRES

- **Axios Docs**: https://axios-http.com/
- **HTTP Caching**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching
- **Request Cancellation**: https://axios-http.com/docs/cancellation
- **Promise.all()**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all

---

**Questions?** Check `API_COMPLETE_SUMMARY.md` ou `API_ENDPOINTS_AUDIT.md`
