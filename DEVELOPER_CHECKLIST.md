# ✅ CHECKLIST DÉVELOPPEUR - API & OPTIMISATIONS

**Mise à jour**: 11 décembre 2025  
**Pour**: Équipe de développement BNN ESURSI

---

## 🎯 AVANT DE CODER

### Configuration
- [ ] `src/config.js` importé dans votre composant
- [ ] Base URL correcte pour l'environnement (dev/prod)
- [ ] Utiliser `getMediaUrl()`, `getFileUrl()`, `getAssetUrl()` au lieu de hardcoder

```javascript
// ✅ BON
import { getMediaUrl, getFileUrl, getAssetUrl } from './config';
const url = getMediaUrl(imagePath);

// ❌ MAUVAIS
const url = `http://localhost:8000${imagePath}`;
```

---

## 🔐 AUTHENTIFICATION

### Login/Register
- [ ] Importer `authAPI` de `./api`
- [ ] Gérer erreurs de validation par champ
- [ ] Afficher message d'erreur standardisé
- [ ] Sauvegarder token après login

```javascript
// ✅ BON
try {
    const response = await authAPI.login(credentials);
    // Token auto-saved, navigate to home
} catch (error) {
    setError(error.message);
}

// ❌ MAUVAIS
const token = response.data.token;
localStorage.setItem('token', token); // Déjà fait par authAPI!
```

### Token Management
- [ ] Pas de manipulation manuelle de token
- [ ] Pas de localStorage.setItem('authToken', ...) directement
- [ ] Utiliser `getSession()` pour lire token
- [ ] Utiliser `saveSession(token, userData)` pour sauvegarder
- [ ] Utiliser `clearSession()` pour logout

```javascript
// ✅ BON
const { token } = getSession();
saveSession(newToken, userData);
clearSession();

// ❌ MAUVAIS
const token = localStorage.getItem('authToken');
localStorage.setItem('authToken', newToken);
```

### Auto-Refresh Token
- [ ] Laisser l'intercepteur gérer automatiquement
- [ ] Pas d'appel manuel à `refreshToken()`
- [ ] En cas de 401: intercepteur retry automatiquement

```javascript
// ✅ BON
// Faire requête, intercepteur gère le 401
await api.get('/user/profile/');

// ❌ MAUVAIS
if (error.status === 401) {
    await authAPI.refreshToken();
    // Réessayer requête
}
```

---

## 📚 RESSOURCES

### Appels API Standard
- [ ] Importer `api` de `./api`
- [ ] Utiliser `api.get()`, `api.post()`, etc.
- [ ] Token automatiquement ajouté via intercepteur
- [ ] Gestion d'erreurs complète

```javascript
// ✅ BON - Auto-authenticated
try {
    const response = await api.get('/ressource/all/');
    const data = response.data?.data || response.data;
    return data;
} catch (error) {
    console.error('Error:', error);
}

// ❌ MAUVAIS - Token ajouté manuellement
const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` }
});
```

### Caching des Requêtes
- [ ] Données stables (domaines, types) → cache 10-15 min
- [ ] Données semi-stables (profil, favoris) → cache 3-5 min
- [ ] Données dynamiques (pagination) → cache 1 min ou pas de cache
- [ ] Importer `cachedApiCall` de `./utils/apiCache`

```javascript
// ✅ BON - Cache domaines (très stables)
const domainesData = await cachedApiCall(
    'page:domaines',
    () => domainesAPI.getDomaines(),
    15 * 60 * 1000
);

// ✅ BON - Cache favoris (change rapidement)
const favoris = await cachedApiCall(
    'user:favoris',
    () => favorisAPI.getFavoris(),
    3 * 60 * 1000
);

// ✅ BON - Pas de cache pagination (données fraîches)
const response = await api.get('/ressources/');
```

### Invalidation Cache
- [ ] Après POST/PUT/DELETE → invalider cache relatif
- [ ] Importer `invalidateCache` de `./utils/apiCache`
- [ ] Invalider avant recharger les données

```javascript
// ✅ BON
import { invalidateCache } from './utils/apiCache';

const addFavorite = async (ressourceId) => {
    await favorisAPI.addFavori(ressourceId);
    invalidateCache('user:favoris'); // Invalider AVANT reload
    const favoris = await getFavorites();
    return favoris;
};

// ❌ MAUVAIS - Pas invalider cache
await favorisAPI.addFavori(ressourceId);
const staleData = await favorisAPI.getFavoris(); // Cache expiré?
```

---

## ⚡ PERFORMANCE

### Parallélisation
- [ ] Utiliser `Promise.all()` pour requêtes indépendantes
- [ ] PAS d'awaits séquentiels si requêtes indépendantes

```javascript
// ✅ BON - Parallèle (~200ms)
const [users, resources, domains] = await Promise.all([
    api.get('/user/profile/'),
    api.get('/ressource/all/'),
    domainesAPI.getDomaines()
]);

// ❌ MAUVAIS - Séquentiel (~600ms)
const users = await api.get('/user/profile/');
const resources = await api.get('/ressource/all/');
const domains = await domainesAPI.getDomaines();
```

### Débounce
- [ ] Search input → utiliser debounce (500ms)
- [ ] Importer `debounce` de `./utils/debounce`
- [ ] Éviter appels API à chaque keystroke

```javascript
// ✅ BON - Débounce
import { debounce } from './utils/debounce';

const debouncedSearch = debounce((query) => {
    // API call après 500ms d'inactivité
}, 500);

<input onChange={(e) => debouncedSearch(e.target.value)} />

// ❌ MAUVAIS - Appel direct
<input onChange={(e) => setSearchTerm(e.target.value)} />
// → API call pour chaque caractère! 😱
```

### Timeouts
- [ ] Standard API calls: 10 secondes
- [ ] File uploads (avatar): 30 secondes
- [ ] PAS de modifier les timeouts sans raison

```javascript
// ✅ BON - Timeouts standards respectés
await api.get('/ressources/'); // 10s timeout
await userAPI.updateAvatar(formData); // 30s timeout (auto)
```

---

## 🧪 GESTION D'ERREURS

### Patterns Recommandés
- [ ] Try-catch sur tous les appels API
- [ ] Message d'erreur standardisé
- [ ] Logging pour debugging
- [ ] Pas d'erreurs "swallowed" silencieusement

```javascript
// ✅ BON
try {
    const response = await api.get('/ressources/');
    return response.data;
} catch (error) {
    const message = error.response?.data?.detail || error.message;
    console.error('Erreur ressources:', message);
    throw new Error(message);
}

// ❌ MAUVAIS - Erreur silencieuse
try {
    const response = await api.get('/ressources/');
} catch (error) {
    // Rien? Oups!
}

// ❌ MAUVAIS - Message non-standardisé
catch (error) {
    alert('Oups, quelque chose s\'est mal passé');
}
```

### Erreurs Spécifiques
- [ ] 401 → Intercepteur gère (redirect /login)
- [ ] 404 → Afficher "Non trouvé"
- [ ] 500 → Afficher "Erreur serveur, réessayez plus tard"
- [ ] Network error → Utiliser fallback mock data

```javascript
// ✅ BON - Gestion spécifique
try {
    const response = await api.get('/ressources/');
} catch (error) {
    if (error.response?.status === 404) {
        setError('Ressource non trouvée');
    } else if (error.response?.status >= 500) {
        setError('Erreur serveur, réessayez plus tard');
    } else if (!error.response) {
        // Network error - utiliser fallback
        setData(mockData);
    }
}
```

---

## 🧹 CODE QUALITY

### Console Logs
- [ ] Logs DEBUG → utiliser console.log()
- [ ] Logs ERROR → utiliser console.error()
- [ ] Logs INFO → utiliser console.info()
- [ ] Pas de console.log en production (optionnel)

```javascript
// ✅ BON
console.log('🔄 Fetching resources...');
console.error('❌ API Error:', error);

// ❌ MAUVAIS - Trop verbeux
console.log('User object:', user);
console.log('Response:', response);
console.log('Starting fetch...');
```

### Variables
- [ ] Noms clairs et descriptifs
- [ ] CamelCase pour variables JS
- [ ] PAS de variables globales pour données API

```javascript
// ✅ BON
const [favoriteResources, setFavoriteResources] = useState([]);
const apiResponse = await api.get('/favoris/');

// ❌ MAUVAIS
const [data, setData] = useState(null);
const resp = await api.get('/favoris/');
```

### Imports
- [ ] Grouper les imports (React, libraries, local)
- [ ] PAS d'imports inutilisés
- [ ] Imports en haut du fichier

```javascript
// ✅ BON
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import api from './api';
import { cachedApiCall } from './utils/apiCache';
import './styles.css';

// ❌ MAUVAIS
import api from './api';
import React from 'react'; // Plus bas
import { useState } from 'react'; // Importé séparé
```

---

## 🚀 AVANT DEPLOYMENT

### Final Checks
- [ ] Tous les endpoints testés
- [ ] Cache hits/misses dans console
- [ ] Token refresh fonctionne
- [ ] Erreurs gérées correctement
- [ ] Pas d'appels API inutiles
- [ ] Network tab clean (pas d'erreurs rouges)
- [ ] Performance acceptable (< 1s initial load)

### Security Checks
- [ ] Pas de tokens en logs
- [ ] Pas de credentials hardcodées
- [ ] HTTPS enforced
- [ ] CORS correctement configuré
- [ ] Pas de données sensibles en localStorage (sauf token)

### Performance Checks
- [ ] Appels API parallélisés (Promise.all)
- [ ] Cache implémenté pour données stables
- [ ] Débounce sur search/input
- [ ] Images optimisées/lazy loaded
- [ ] Bundle size acceptable

---

## 📚 FICHIERS DE RÉFÉRENCE

| Fichier | Quand l'utiliser | Status |
|---------|------------------|--------|
| `src/api.js` | Tous les appels API | ✅ Production-ready |
| `src/config.js` | URLs, media paths | ✅ Production-ready |
| `src/utils/auth.js` | Auth management | ✅ Production-ready |
| `src/utils/apiCache.js` | Caching requests | ✅ NEW - Production-ready |
| `src/utils/debounce.js` | Débounce/throttle | ✅ NEW - Production-ready |
| `src/mockData.js` | Fallback offline | ✅ Development |
| `API_ENDPOINTS_AUDIT.md` | List all endpoints | 📚 Reference |
| `API_OPTIMIZATIONS_GUIDE.md` | Setup/config | 📚 Reference |
| `API_COMPLETE_SUMMARY.md` | Full overview | 📚 Reference |
| `API_USAGE_EXAMPLES.md` | Code examples | 📚 Reference |

---

## 🐛 DEBUGGING TRICKS

### Voir tous les appels API
```javascript
// Dans DevTools Console
// Aller à Network tab, filter "XHR"
// Voir toutes les requêtes avec status/timing
```

### Voir le cache
```javascript
// Dans DevTools Console
import { getCacheStats } from './utils/apiCache.js';
getCacheStats(); // Affiche cache entries
```

### Vérifier token
```javascript
// Dans DevTools Console
import { getSession } from './utils/auth.js';
getSession(); // Affiche { token, userData, loginTime }
```

### Forcer refresh données
```javascript
// Dans DevTools Console
import { invalidateCache } from './utils/apiCache.js';
invalidateCache('page:domaines');
// Puis recharger page
```

---

## ❓ FAQ RAPIDE

**Q: Mon appel API est lent?**
- A: Check Network tab pour TTFB (Time To First Byte)
- A: Si backend slow → escalader
- A: Si réseau slow → utiliser cache ou compression

**Q: Cache ne se met pas à jour?**
- A: TTL expiré? Vérifier valeur TTL
- A: Oublié d'invalider? Ajouter `invalidateCache(key)`
- A: Clé différente? Vérifier cacheKey exacte

**Q: Token refresh ne fonctionne pas?**
- A: `/auth/refresh/` endpoint existe?
- A: Format réponse correct? `{ token: "..." }`
- A: Check console pour "Token refresh failed"

**Q: Appels API en double?**
- A: Débounce manquant? Ajouter sur input
- A: Promise.all pas utilisé? Mettre requêtes en parallèle
- A: useEffect rerun? Vérifier dependencies

**Q: Images ne chargent pas?**
- A: Utiliser `getMediaUrl()` au lieu de hardcoded path
- A: Vérifier path est correct
- A: Check Network tab pour 404 errors

---

## 📞 AIDE & SUPPORT

**Problème API?** → Check `API_ENDPOINTS_AUDIT.md`  
**Comment utiliser?** → Check `API_USAGE_EXAMPLES.md`  
**Performance issue?** → Check `API_COMPLETE_SUMMARY.md`  
**Setup problem?** → Check `API_OPTIMIZATIONS_GUIDE.md`  

---

**Dernière mise à jour**: 11 décembre 2025  
**Prochaine révision**: Après 1 semaine production

**👍 Bon coding!**
