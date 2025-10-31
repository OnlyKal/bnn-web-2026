# Authentication System Documentation

Ce document explique comment utiliser le système d'authentification implémenté dans l'application BNN ESURSI Web.

## Fonctionnalités implémentées

### 1. Connexion (Login)
- **Fichier principal**: `src/UTILISATEURS/Connexion.jsx`
- **Endpoint**: `POST http://localhost:8000/api/bnn/user/signin/`
- **Données requises**: 
  ```json
  {
    "username": "bnn@gmail.com" ou "tony",
    "password": "000"
  }
  ```

### 2. Gestion de session
- **Fichier utilitaire**: `src/utils/auth.js`
- Stockage sécurisé du token et des données utilisateur dans `localStorage`
- Vérification de l'état d'authentification
- Gestion de l'expiration de session
- Déconnexion automatique

### 3. API Service
- **Fichier**: `src/services/api.js`
- Intercepteurs pour ajouter automatiquement le token d'authentification
- Gestion automatique des erreurs d'authentification
- Redirection automatique en cas de token expiré

### 4. Protection des routes
- **Composant**: `src/components/ProtectedRoute.jsx`
- Protection basée sur l'authentification
- Protection basée sur les rôles (optionnel)
- Redirection automatique vers la page de connexion

## Comment utiliser

### 1. Connexion basique

```jsx
import { authAPI } from './services/api';
import { saveSession } from './utils/auth';

const handleLogin = async (username, password) => {
    try {
        const response = await authAPI.login({ username, password });
        if (response.status === 200) {
            saveSession(response.token, response.data);
            // Redirection vers le dashboard
        }
    } catch (error) {
        console.error('Erreur de connexion:', error);
    }
};
```

### 2. Vérification de l'authentification

```jsx
import { isAuthenticated, getCurrentUser } from './utils/auth';

// Vérifier si l'utilisateur est connecté
if (isAuthenticated()) {
    const user = getCurrentUser();
    console.log('Utilisateur connecté:', user);
}
```

### 3. Protection d'une page

```jsx
import ProtectedRoute from './components/ProtectedRoute';

function SecurePage() {
    return (
        <ProtectedRoute>
            <div>Contenu protégé</div>
        </ProtectedRoute>
    );
}
```

### 4. Protection avec rôles

```jsx
import ProtectedRoute from './components/ProtectedRoute';

function AdminPage() {
    return (
        <ProtectedRoute allowedRoles={['admin', 'moderateur']}>
            <div>Page administrateur</div>
        </ProtectedRoute>
    );
}
```

### 5. Requêtes API authentifiées

```jsx
import { userAPI } from './services/api';

// Les headers d'authentification sont ajoutés automatiquement
const fetchUserProfile = async () => {
    try {
        const profile = await userAPI.getProfile();
        return profile;
    } catch (error) {
        console.error('Erreur:', error);
    }
};
```

### 6. Déconnexion

```jsx
import { logout } from './utils/auth';

const handleLogout = () => {
    logout();
    window.location.href = '/login';
};
```

## Fonctions utilitaires disponibles

### `src/utils/auth.js`

| Fonction | Description |
|----------|-------------|
| `saveSession(token, userData)` | Sauvegarde la session dans localStorage |
| `getSession()` | Récupère les données de session |
| `clearSession()` | Efface la session |
| `isAuthenticated()` | Vérifie si l'utilisateur est connecté |
| `getCurrentUser()` | Récupère les données de l'utilisateur connecté |
| `getAuthHeader()` | Récupère l'header d'autorisation pour les API |
| `isSessionExpired(hours)` | Vérifie si la session a expiré |
| `logout()` | Déconnecte l'utilisateur |

### `src/services/api.js`

| Service | Fonctions disponibles |
|---------|----------------------|
| `authAPI` | `login()`, `register()`, `resetPassword()` |
| `userAPI` | `getProfile()`, `updateProfile()`, `uploadAvatar()` |
| `dataAPI` | `getData()`, `createData()`, `updateData()`, `deleteData()` |

## Structure des données utilisateur

Après connexion réussie, les données utilisateur suivantes sont disponibles :

```json
{
    "id": 3,
    "username": "mak",
    "matricule": "BNN2-F-V-V-Z-0",
    "telephone": "0987655432",
    "nom": "",
    "prenom": "",
    "email": "bnn@gmail.com",
    "role": "etudiant",
    "sexe": "masculin",
    "faculte": "education",
    "date_naissance": "2025-10-22T06:11:22+02:00",
    "province": "Haut-Katanga",
    "universite": "HAUTE ECOLE DE COMMERCE DE KINSHASA",
    "avatar": "/media/avatars/3dc31651-fb68-40f3-9b45-040bbd9221ba.webp",
    "avatar_url": "/media/avatars/3dc31651-fb68-40f3-9b45-040bbd9221ba.webp",
    "date_inscription": "2025-10-13T09:29:36.449293+02:00"
}
```

## Configuration

### Variables d'environnement recommandées

Créez un fichier `.env` à la racine du projet :

```env
VITE_API_BASE_URL=http://localhost:8000/api/bnn
VITE_SESSION_DURATION_HOURS=24
```

### Utilisation des variables d'environnement

```javascript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/bnn';
const SESSION_DURATION = import.meta.env.VITE_SESSION_DURATION_HOURS || 24;
```

## Sécurité

### Bonnes pratiques implémentées

1. **Token JWT** : Stockage sécurisé du token d'authentification
2. **Expiration automatique** : Vérification de l'expiration de session
3. **Déconnexion automatique** : En cas de token invalide (401)
4. **Protection des routes** : Composant ProtectedRoute
5. **Headers automatiques** : Ajout automatique des headers d'auth
6. **Validation côté client** : Vérification des champs avant envoi

### Recommandations de sécurité

1. **HTTPS en production** : Utilisez toujours HTTPS en production
2. **Token refresh** : Implémentez un système de refresh token pour les sessions longues
3. **Validation serveur** : Toujours valider l'authentification côté serveur
4. **Chiffrement** : Considérez le chiffrement des données sensibles
5. **Audit** : Loggez les tentatives de connexion

## Dépannage

### Erreurs courantes

1. **401 Unauthorized** : Token expiré ou invalide
2. **Network Error** : Serveur non accessible
3. **CORS Error** : Configuration CORS du serveur

### Debug

```javascript
// Activer les logs de debug
localStorage.setItem('debug', 'true');

// Vérifier l'état de la session
console.log('Session:', getSession());
console.log('Authenticated:', isAuthenticated());
```

## Migration depuis l'ancien système

Si vous avez un ancien système d'authentification :

1. Remplacez les appels directs à `localStorage` par les fonctions utilitaires
2. Utilisez le composant `ProtectedRoute` pour les pages protégées
3. Remplacez les requêtes axios manuelles par les services API
4. Ajoutez la gestion d'erreur centralisée

## Support

Pour toute question ou problème, consultez :
- La documentation de l'API backend
- Les logs de la console navigateur
- Les fichiers d'exemple dans `src/components/`