# Format des Données API - HomePage Ressources

## 📋 Structure de Réponse de l'API

L'API `http://localhost:8000/api/bnn/ressources/` retourne les données dans le format suivant :

### 🔗 Structure Principale
```json
{
    "next": "http://localhost:8000/api/bnn/ressources/?cursor=cD00",
    "previous": null,
    "results": {
        "message": "Liste des ressources récupérée avec succès",
        "status": 200,
        "data": [
            // Array des ressources
        ]
    }
}
```

### 📄 Structure d'une Ressource
```json
{
    "id": 6,
    "titre": "Introduction à l'Apprentissage Automatique",
    "sous_titre": "Concepts et applications",
    "auteurs": "Serge Mbemba, Aline Kaseka",
    "edition": "2e",
    "lieu_edition": "Kinshasa",
    "description": "<p>Le lorem ipsum est, en imprimerie...</p>",
    "domaine": {
        "id": 7,
        "nom": "Environnement"
    },
    "sous_domaine": {
        "id": 26,
        "nom": "Conservation de la biodiversité",
        "domaine": {
            "id": 7,
            "nom": "Environnement"
        }
    },
    "format": "png",
    "ISBN": "00000ISBN",
    "langue": "en",
    "pays": "République Démocratique du Congo",
    "type": "image",
    "couverture": "/media/couvertures/cover.png",
    "date_publication": "2025-10-29",
    "fichiers": [
        {
            "id": 15,
            "titre": "87876R56",
            "fichier": "/media/ressources/file.png",
            "ordre": 0,
            "duree": null,
            "date_ajout": "2025-10-29T16:15:00.186656+01:00"
        }
    ]
}
```

## 🔧 Adaptations dans le Code

### 1. **Extraction des Données**
```javascript
// Avant (structure simple)
const ressourcesData = response.data.results || [];

// Maintenant (structure imbriquée)  
const ressourcesData = response.data.results?.data || response.data.results || [];
```

### 2. **URLs des Fichiers**
```javascript
// Construction des URLs complètes
const baseURL = 'http://localhost:8000';

// Pour les couvertures
const coverURL = `${baseURL}${ressource.couverture}`;

// Pour les fichiers
const fileURL = `${baseURL}${ressource.fichiers[0].fichier}`;
```

### 3. **Propriétés des Fichiers**
```javascript
// Nouvelle structure des fichiers
{
    "id": 15,
    "titre": "Nom du fichier",        // au lieu de "nom"
    "fichier": "/media/path/file.ext", // au lieu de "url"
    "ordre": 0,
    "duree": "45:30",                 // pour les vidéos
    "date_ajout": "2025-10-29T16:15:00Z"
}
```

## 🎨 Types et Formats Supportés

### Types de Ressources
- `"document"` - Documents PDF, Word, etc.
- `"video"` - Fichiers vidéo MP4, AVI, etc.
- `"image"` - Images PNG, JPG, etc.
- `"audio"` - Fichiers audio MP3, WAV, etc.

### Formats de Fichiers
- `"pdf"` - Documents PDF
- `"mp4"` - Vidéos MP4
- `"png"` - Images PNG
- `"jpg"/"jpeg"` - Images JPEG
- `"docx"` - Documents Word
- `"zip"` - Archives compressées

## 🔍 Recherche et Filtrage

### Champs de Recherche
La recherche s'effectue sur :
```javascript
- ressource.titre
- ressource.sous_titre  
- ressource.domaine.nom
- ressource.sous_domaine.nom
```

### Logique de Filtrage
```javascript
const filtered = ressources.filter(ressource => 
    ressource.titre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ressource.sous_titre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ressource.domaine?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ressource.sous_domaine?.nom?.toLowerCase().includes(searchTerm.toLowerCase())
);
```

## 🚀 Actions sur les Ressources

### Ouvrir/Lire une Ressource
```javascript
const handleViewResource = (ressource) => {
    if (ressource.fichiers && ressource.fichiers.length > 0) {
        const fileUrl = `http://localhost:8000${ressource.fichiers[0].fichier}`;
        window.open(fileUrl, '_blank');
    }
};
```

### Télécharger une Ressource
```javascript
const handleDownloadResource = (ressource) => {
    if (ressource.fichiers && ressource.fichiers.length > 0) {
        const fileUrl = `http://localhost:8000${ressource.fichiers[0].fichier}`;
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = ressource.fichiers[0].titre || ressource.titre;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};
```

## 🧪 Mode Test

### Basculer entre API et Données Mockées
L'interface inclut un bouton "Switch" dans l'en-tête pour basculer entre :
- **API** : Données réelles depuis `http://localhost:8000/api/bnn/ressources/`
- **Mock** : Données de test locales pour le développement

### État du Bouton
```javascript
const [useMockData, setUseMockData] = useState(false);

// Basculer la source de données
setUseMockData(!useMockData);
fetchRessources(); // Recharger les données
```

## 📋 Métadonnées Disponibles

### Informations Principales
- `id` - Identifiant unique
- `titre` - Titre de la ressource
- `sous_titre` - Sous-titre descriptif
- `description` - Description HTML complète
- `auteurs` - Liste des auteurs (string)

### Informations de Publication
- `edition` - Numéro d'édition (ex: "2e")
- `lieu_edition` - Ville d'édition
- `ISBN` - Code ISBN
- `langue` - Code langue ("fr", "en", etc.)
- `pays` - Pays d'origine
- `date_publication` - Date au format YYYY-MM-DD

### Classification
- `domaine` - Domaine principal (objet avec id et nom)
- `sous_domaine` - Sous-domaine (objet avec id, nom et domaine parent)
- `type` - Type de ressource
- `format` - Format du fichier principal

### Fichiers Associés
- `couverture` - Chemin vers l'image de couverture
- `fichiers[]` - Array des fichiers disponibles
  - `id` - ID du fichier
  - `titre` - Nom du fichier
  - `fichier` - Chemin du fichier
  - `ordre` - Ordre d'affichage
  - `duree` - Durée pour les médias
  - `date_ajout` - Date d'ajout

## ⚠️ Gestion d'Erreurs

### Fallback sur Images
```javascript
onError={(e) => {
    e.target.style.display = 'none';
    e.target.nextSibling.style.display = 'flex';
}}
```

### Fallback sur Données
```javascript
try {
    // Tentative API réelle
    const response = await api.get('/ressources/');
    const ressourcesData = response.data.results?.data || [];
    setRessources(ressourcesData);
} catch (apiError) {
    // Fallback sur données mockées
    const mockResponse = await simulateApiCall(mockRessources);
    const ressourcesData = mockResponse.results?.data || [];
    setRessources(ressourcesData);
}
```

## 🔄 Pagination

### Propriétés de Pagination
```json
{
    "next": "http://localhost:8000/api/bnn/ressources/?cursor=cD00",
    "previous": null
}
```

### Implémentation Future
```javascript
// À implémenter pour la navigation par pages
const handleNextPage = () => {
    if (nextPageUrl) {
        fetchRessources(nextPageUrl);
    }
};
```

---

**Version :** 2.0 - Adaptée au format API réel  
**Date :** 29 octobre 2025  
**Compatibilité :** API Django BNN ESURSI