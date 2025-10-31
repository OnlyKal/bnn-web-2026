# Guide de Test - HomePage Ressources Adaptée

## 🎯 Objectif
La HomePage a été adaptée pour correspondre exactement au format de données de votre API Django, permettant d'afficher les ressources avec leur structure réelle.

## 🔧 Nouvelles Fonctionnalités

### 1. **Support du Format API Réel**
✅ Structure imbriquée : `results.data[]` au lieu de `results[]`  
✅ URLs relatives converties en URLs complètes  
✅ Propriétés des fichiers adaptées (`fichier` au lieu de `url`, `titre` au lieu de `nom`)  
✅ Métadonnées étendues (édition, lieu, ISBN, langue, pays)  

### 2. **Bouton de Test API/Mock**
Dans l'en-tête de la page, un bouton **"Switch"** permet de basculer entre :
- **API** : Données réelles depuis `http://localhost:8000/api/bnn/ressources/`
- **Mock** : Données de test locales (8 ressources d'exemple)

### 3. **Gestion d'Erreurs Améliorée**
- Fallback automatique sur données mockées si l'API n'est pas disponible
- Gestion des images manquantes avec placeholder
- Console logs pour debugging

## 🚀 Comment Tester

### **Étape 1 : Démarrer l'Application**
```bash
cd /Users/cgiibnn/Desktop/PROJECTS/bnn-esursi-web
npm run dev
```
L'app sera disponible sur `http://localhost:5175/`

### **Étape 2 : Se Connecter**
- Utilisez vos identifiants habituels
- Vous arriverez automatiquement sur la HomePage avec les ressources

### **Étape 3 : Tester avec l'API Réelle**
1. Assurez-vous que votre serveur Django tourne sur `http://localhost:8000`
2. Le bouton doit afficher **"API"** (mode par défaut)
3. Les ressources de votre base de données s'affichent
4. Testez la recherche en tapant dans la barre de recherche
5. Cliquez sur **"Lire"** pour ouvrir un fichier
6. Cliquez sur **"Télécharger"** pour télécharger un fichier

### **Étape 4 : Tester avec les Données Mockées**
1. Cliquez sur le bouton **"Switch"** dans l'en-tête
2. Le bouton devient vert et affiche **"Mock"**
3. 8 ressources d'exemple s'affichent (React, Algorithmes, etc.)
4. Testez les mêmes fonctionnalités qu'à l'étape 3

### **Étape 5 : Tester la Recherche**
- Tapez des mots-clés comme :
  - **"React"** - trouve la ressource React.js
  - **"Informatique"** - trouve toutes les ressources informatiques
  - **"Apprentissage"** - trouve les ressources sur l'IA
  - **"Kinshasa"** - ne trouve rien (lieu d'édition non searchable)

### **Étape 6 : Vérifier la Console**
Ouvrez les DevTools (F12) et regardez la console pour :
- Les logs de réponse API : `"API Response:"`
- Les erreurs éventuelles
- Le basculement entre sources de données

## 📋 Checklist de Validation

### ✅ Affichage des Données
- [ ] Les ressources s'affichent correctement depuis l'API
- [ ] Les images de couverture se chargent (avec URL `http://localhost:8000/media/...`)
- [ ] Les métadonnées sont complètes (titre, auteurs, domaine, date)
- [ ] Les icônes correspondent aux formats (PDF=📘, MP4=🎥, PNG=🖼️)
- [ ] Les badges de type s'affichent correctement

### ✅ Recherche et Filtrage  
- [ ] La recherche fonctionne sur les titres
- [ ] La recherche fonctionne sur les sous-titres
- [ ] La recherche fonctionne sur les domaines
- [ ] La recherche fonctionne sur les sous-domaines
- [ ] Le compteur de résultats est correct
- [ ] L'état vide s'affiche quand aucun résultat

### ✅ Actions sur les Ressources
- [ ] Le bouton "Lire" ouvre le fichier dans un nouvel onglet
- [ ] Le bouton "Télécharger" lance le téléchargement
- [ ] Les URLs des fichiers sont correctes (`http://localhost:8000/media/...`)
- [ ] Les actions fonctionnent pour différents types de fichiers

### ✅ Interface et UX
- [ ] Le design est moderne sans shadow ni gradients
- [ ] La couleur bleue est utilisée comme couleur principale
- [ ] Le layout est responsive (testez sur mobile)
- [ ] Les hover effects fonctionnent
- [ ] Les états de chargement s'affichent

### ✅ Robustesse
- [ ] Le fallback sur données mockées fonctionne
- [ ] Les images manquantes affichent un placeholder
- [ ] Aucune erreur dans la console
- [ ] Le switch API/Mock fonctionne

## 🐛 Résolution de Problèmes

### **Problème : Aucune ressource ne s'affiche**
**Solutions :**
1. Vérifiez que Django tourne sur `http://localhost:8000`
2. Vérifiez l'endpoint `/api/bnn/ressources/` dans un navigateur
3. Utilisez le mode Mock pour tester l'interface
4. Regardez la console pour les erreurs

### **Problème : Images ne se chargent pas**
**Solutions :**
1. Vérifiez que les fichiers existent dans `/media/couvertures/`
2. Vérifiez les permissions de Django pour servir les médias
3. Testez une URL d'image directement : `http://localhost:8000/media/couvertures/nom-fichier.jpg`

### **Problème : Téléchargement ne fonctionne pas**
**Solutions :**
1. Vérifiez que les fichiers existent dans `/media/ressources/`
2. Vérifiez la configuration des médias dans Django
3. Testez l'URL du fichier directement dans le navigateur

### **Problème : Erreurs CORS**
**Solutions :**
1. Ajoutez `django-cors-headers` à votre Django
2. Configurez `CORS_ALLOWED_ORIGINS = ['http://localhost:5175']`
3. Ou utilisez `CORS_ALLOW_ALL_ORIGINS = True` pour le développement

## 📊 Données de Test Incluses

Les données mockées incluent 8 ressources couvrant :

1. **React.js** (PDF) - Informatique/Développement Web
2. **Algorithmes** (MP4) - Informatique/Algorithmes  
3. **Bases de données** (PDF) - Informatique/Bases de données
4. **Photoshop** (MP4) - Design/Retouche Photo
5. **Mathématiques** (PDF) - Mathématiques/Statistiques
6. **Architecture** (PNG) - Architecture/Design Contemporain
7. **Marketing Digital** (PDF) - Marketing/Marketing Digital
8. **Python Data Science** (MP4) - Informatique/Data Science

## 🔄 Prochaines Étapes

Après validation, vous pourrez :
1. **Supprimer le bouton Switch** pour la production
2. **Ajouter la pagination** (next/previous URLs)
3. **Implémenter le tri** par date, titre, type
4. **Ajouter des filtres** par domaine, format
5. **Optimiser les performances** avec du cache

---

**Status :** ✅ Prêt pour les tests  
**Version :** 2.0 - Adaptée API Django  
**URL de test :** http://localhost:5175/