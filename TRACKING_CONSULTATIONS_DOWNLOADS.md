# 📊 Tracking Consultations & Téléchargements

## ✅ **Fonctionnalités Implémentées**

### 🔍 **API Consultations**
- **Endpoint** : `POST /consultations/`
- **Body** : `{"ressource_id": 25}`
- **Déclencheur** : Clic sur bouton "Ouvrir"
- **Action** : Enregistre la consultation + Ouvre le fichier

### 📥 **API Téléchargements**
- **Endpoint** : `POST /downloads/`
- **Body** : `{"ressource_id": 25}`
- **Déclencheur** : Clic sur bouton "Télécharger"
- **Action** : Enregistre le téléchargement + Lance le téléchargement

## 🔧 **Code Ajouté dans RessourceDetails.jsx**

### **Fonctions Ajoutées**
```javascript
// Enregistre la consultation
const recordConsultation = async (ressourceId) => {
    await api.post('/consultations/', { ressource_id: ressourceId });
}

// Enregistre le téléchargement
const recordDownload = async (ressourceId) => {
    await api.post('/downloads/', { ressource_id: ressourceId });
}

// Action "Ouvrir" avec tracking
const handleOpen = async (fileUrl) => {
    await recordConsultation(ressource.id);
    window.open(fullUrl, '_blank');
}

// Action "Télécharger" avec tracking (modifiée)
const handleDownload = async (fileUrl, filename) => {
    await recordDownload(ressource.id);
    // ... code téléchargement existant
}
```

### **Boutons Modifiés**
```jsx
// Bouton Ouvrir
<button onClick={() => handleOpen(fichier.fichier)}>
    <FaEye /> Ouvrir
</button>

// Bouton Télécharger (inchangé, fonction modifiée)
<button onClick={() => handleDownload(fichier.fichier, fichier.titre)}>
    <FaDownload /> Télécharger
</button>
```

## 🛡️ **Gestion des Erreurs**
- **Authentification** : Utilise l'API authentifiée
- **Erreurs silencieuses** : N'interrompt pas l'action si le tracking échoue
- **Logs détaillés** : Console pour debugging

## 📊 **Résultat**
- **Consultation** : Chaque ouverture de fichier est trackée
- **Téléchargement** : Chaque téléchargement est enregistré
- **UX préservée** : L'utilisateur ne voit aucun changement
- **Analytics** : Données disponibles côté serveur

**Maintenant vous pouvez suivre l'usage des ressources !** 📈