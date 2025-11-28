# Configuration Centralisée pour l'Adresse du Serveur

## 📋 Vue d'ensemble

Tous les URLs hardcodés `http://localhost:8000` ont été remplacés par des variables de configuration centralisées dans le fichier `src/config.js`. Cela facilite le changement de l'adresse du serveur pour différents environnements (développement, staging, production).

## 🔧 Fichier de Configuration

### `src/config.js`

Ce fichier contient toutes les variables de configuration pour l'application :

```javascript
// API Server Base URL (sans /api/bnn)
export const API_SERVER_URL = 'http://localhost:8000';

// API Base URL (avec /api/bnn)
export const API_BASE_URL = `${API_SERVER_URL}/api/bnn`;

// Fonctions helper pour construire les URLs
export const getMediaUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${API_SERVER_URL}${path}`;
};

export const getFileUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${API_SERVER_URL}${path}`;
};
```

## 📂 Fichiers Modifiés

Les fichiers suivants ont été mis à jour pour utiliser la configuration centralisée :

### 1. **`src/config.js`** (nouveau)
   - Fichier de configuration principal
   - Contient `API_SERVER_URL` et `API_BASE_URL`
   - Fonctions helper `getMediaUrl()` et `getFileUrl()`

### 2. **`src/api.js`**
   - Import de `API_BASE_URL` depuis `config.js`
   - Suppression de la constante locale `API_BASE_URL`

### 3. **`src/services/api.js`**
   - Import de `API_BASE_URL` depuis `config.js`
   - Suppression de la constante locale `API_BASE_URL`

### 4. **`src/HomePage.jsx`**
   - Import de `getMediaUrl` et `getFileUrl`
   - Remplacement de tous les `http://localhost:8000` par les fonctions helper
   - URLs d'avatar, couvertures et fichiers maintenant dynamiques

### 5. **`src/Profile.jsx`**
   - Import de `getMediaUrl`
   - URL d'avatar maintenant dynamique

### 6. **`src/RessourceDetails.jsx`**
   - Import de `getMediaUrl` et `getFileUrl`
   - URLs de couvertures et fichiers maintenant dynamiques

### 7. **`src/FavorisPage.jsx`**
   - Import de `getMediaUrl`
   - URLs de couvertures maintenant dynamiques

### 8. **`src/components/Dashboard.jsx`**
   - Import de `API_BASE_URL` et `getMediaUrl`
   - URLs maintenant dynamiques

## 🚀 Comment Changer l'Adresse du Serveur

### Pour le Développement Local
Le fichier est déjà configuré pour `localhost:8000` :
```javascript
export const API_SERVER_URL = 'http://localhost:8000';
```

### Pour un Serveur de Staging
Modifiez simplement `src/config.js` :
```javascript
export const API_SERVER_URL = 'http://staging.example.com';
```

### Pour la Production
```javascript
export const API_SERVER_URL = 'https://api.bnn-esursi.com';
```

### Avec des Variables d'Environnement (Recommandé)
Pour une solution plus flexible, vous pouvez utiliser des variables d'environnement Vite :

1. Créez un fichier `.env` à la racine :
```env
VITE_API_SERVER_URL=http://localhost:8000
```

2. Modifiez `src/config.js` :
```javascript
export const API_SERVER_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:8000';
```

3. Pour différents environnements :
   - `.env.development` - pour le développement
   - `.env.staging` - pour le staging
   - `.env.production` - pour la production

## ✅ Avantages

1. **Configuration Centralisée** : Un seul endroit pour changer l'URL du serveur
2. **Facilité de Déploiement** : Changement rapide pour différents environnements
3. **Maintenabilité** : Plus facile à maintenir et mettre à jour
4. **Flexibilité** : Support des URLs absolues et relatives
5. **Sécurité** : Gestion intelligente des URLs avec validation

## 🔍 Fonctions Helper

### `getMediaUrl(path)`
Construit l'URL complète pour les fichiers média (images, avatars, couvertures).

**Exemples :**
```javascript
getMediaUrl('/media/avatars/user1.jpg') 
// → 'http://localhost:8000/media/avatars/user1.jpg'

getMediaUrl('http://cdn.example.com/image.jpg') 
// → 'http://cdn.example.com/image.jpg' (inchangé)

getMediaUrl(null) 
// → null
```

### `getFileUrl(path)`
Construit l'URL complète pour les fichiers téléchargeables.

**Exemples :**
```javascript
getFileUrl('/media/documents/doc.pdf') 
// → 'http://localhost:8000/media/documents/doc.pdf'

getFileUrl('https://external.com/file.pdf') 
// → 'https://external.com/file.pdf' (inchangé)
```

## 🧪 Test

Après modification de `src/config.js`, testez les fonctionnalités suivantes :

- [ ] Connexion utilisateur
- [ ] Affichage des ressources sur la page d'accueil
- [ ] Images de couverture des ressources
- [ ] Avatar utilisateur
- [ ] Téléchargement de fichiers
- [ ] Consultation de fichiers
- [ ] Page des favoris
- [ ] Profil utilisateur

## 📝 Notes Importantes

1. **N'oubliez pas de redémarrer le serveur de développement** après avoir modifié `src/config.js`
2. Les fonctions helper gèrent automatiquement les URLs absolues (commençant par `http://` ou `https://`)
3. Les URLs `null` ou `undefined` sont gérées correctement et retournent `null`
4. Pour la production, utilisez toujours HTTPS (`https://`) au lieu de HTTP

## 🔗 Références

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [React Configuration Best Practices](https://create-react-app.dev/docs/adding-custom-environment-variables/)

---

**Dernière mise à jour :** 18 novembre 2025
