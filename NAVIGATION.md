# Navigation et Routing - BNN ESURSI Web

## Structure de navigation mise en place

### Routes publiques (non authentifiées)
- `/login` - Page de connexion
- `/register` - Page d'inscription

### Routes protégées (authentifiées)
- `/home` - Page d'accueil après connexion
- `/profile` - Profil utilisateur
- `/provinces` - Liste des provinces
- `/user-types` - Types d'utilisateurs

### Routes spéciales
- `/` - Redirige vers `/home` si authentifié, sinon vers `/login`
- `*` - Page 404 pour les routes non existantes

## Fonctionnement

### 1. **Login et redirection automatique**
- Après connexion réussie, l'utilisateur est automatiquement redirigé vers `/home`
- Si un utilisateur déjà connecté essaie d'accéder à `/login`, il est redirigé vers `/home`

### 2. **Protection des routes**
- Toutes les routes protégées utilisent le composant `<ProtectedRoute>`
- Si l'utilisateur n'est pas authentifié, redirection automatique vers `/login`
- Vérification de l'expiration de session

### 3. **Navigation dans l'application**
- Boutons de navigation sur chaque page
- Menu de déconnexion disponible partout
- Navigation par liens programmatiques avec `useNavigate()`

## Composants de navigation

### **HomePage.jsx**
- Page d'accueil principale après connexion
- Affiche les informations de l'utilisateur
- Boutons d'accès rapide vers les autres pages
- Header avec navigation et déconnexion

### **Profile.jsx**
- Gestion du profil utilisateur
- Mode lecture et édition
- Retour vers l'accueil

### **Pages existantes mises à jour**
- `Provinces.jsx` - Navigation ajoutée
- `TypeUtilisateurs.jsx` - Navigation ajoutée
- `Connexion.jsx` - Lien vers inscription, redirection après login
- `Inscription.jsx` - Lien retour vers connexion

## Utilisation

### **Navigation programmatique**
```jsx
import { useNavigate } from 'react-router-dom';

function MonComposant() {
    const navigate = useNavigate();
    
    const allerVersAccueil = () => {
        navigate('/home');
    };
    
    const allerVersProfile = () => {
        navigate('/profile');
    };
}
```

### **Liens déclaratifs**
```jsx
import { Link } from 'react-router-dom';

function Navigation() {
    return (
        <nav>
            <Link to="/home">Accueil</Link>
            <Link to="/profile">Profil</Link>
            <Link to="/provinces">Provinces</Link>
        </nav>
    );
}
```

### **Protection de route personnalisée**
```jsx
<Route 
    path="/admin" 
    element={
        <ProtectedRoute allowedRoles={['admin']}>
            <AdminPage />
        </ProtectedRoute>
    } 
/>
```

## Flux de navigation

### **Première visite**
1. Utilisateur arrive sur `/` ou toute route
2. Pas d'authentification → Redirection vers `/login`
3. Connexion réussie → Redirection vers `/home`

### **Utilisateur connecté**
1. Arrive sur `/` → Redirection vers `/home`
2. Navigation libre entre les routes protégées
3. Déconnexion → Redirection vers `/login`

### **Session expirée**
1. Tentative d'accès à une route protégée
2. Token expiré détecté → Déconnexion automatique
3. Redirection vers `/login`

## Fonctionnalités implémentées

### ✅ **Navigation complète**
- Router React configuré
- Routes publiques et protégées
- Redirection automatique selon l'état d'authentification

### ✅ **Interface utilisateur**
- Page d'accueil avec informations utilisateur
- Page de profil avec édition
- Navigation cohérente sur toutes les pages
- Messages d'erreur et de succès

### ✅ **Sécurité**
- Protection des routes sensibles
- Vérification d'authentification
- Gestion de l'expiration de session
- Déconnexion sécurisée

### ✅ **Expérience utilisateur**
- Navigation intuitive
- États de chargement
- Messages informatifs
- Retours visuels

## Pour ajouter une nouvelle page

1. **Créer le composant** dans le dossier approprié
2. **Ajouter la route** dans `App.jsx`
3. **Protéger si nécessaire** avec `<ProtectedRoute>`
4. **Ajouter la navigation** vers cette page dans les autres composants

### Exemple :
```jsx
// Dans App.jsx
<Route 
    path="/nouvelle-page" 
    element={
        <ProtectedRoute>
            <NouvellePage />
        </ProtectedRoute>
    } 
/>

// Dans un autre composant
const navigate = useNavigate();

<button onClick={() => navigate('/nouvelle-page')}>
    Aller à la nouvelle page
</button>
```

## URL de test

Une fois le serveur démarré (`npm run dev`), vous pouvez tester :

- http://localhost:5174/ (redirection automatique)
- http://localhost:5174/login (page de connexion)
- http://localhost:5174/home (après connexion)
- http://localhost:5174/profile (profil utilisateur)
- http://localhost:5174/provinces (liste des provinces)
- http://localhost:5174/user-types (types d'utilisateurs)

## Données de test

Utilisez les données de connexion fournies :
- **Username**: `bnn@gmail.com` ou `tony`
- **Password**: `000`

L'API doit être disponible sur `http://localhost:8000/api/bnn/`