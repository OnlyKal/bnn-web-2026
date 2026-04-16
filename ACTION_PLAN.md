# 🚀 ACTION PLAN - Diagnostic et Résolution

## Situation Actuelle
**Problème**: Ressource "Political obligations" existe dans la BD mais ne s'affiche pas en recherche
**Date**: 19 février 2026

---

## ✅ Améliorations Apportées (Frontend)

### 1. 📊 Logs Améliorés dans `performServerSearch()`
Ajouté le logging détaillé:
```javascript
// console.log('📊 Full API Response:', response.data);
// console.log('   Results titles:', data.map(r => r.titre).slice(0, 5));
// console.log('   Error details:', error.response?.data || error);
```

**Bénéfice**: Voir exactement ce que l'API retourne

---

### 2. 🔄 Fallback Local Search
Si l'API retourne 0 résultats, le frontend cherche maintenant dans les ressources chargées localement:

```javascript
performLocalSearch(query) → cherche dans allResources
  ✓ Titre
  ✓ Description  
  ✓ Domaine
```

**Bénéfice**: Les ressources seront trouvées même si l'API n'a pas d'index

**Exemple**:
```
API: total_count: 0
→ Déclenche recherche locale
→ Trouve 5 résultats avec "Political"
→ Affiche les résultats
```

---

## 🧪 Comment Tester

### Étape 1: Ouvrir l'application
```bash
npm run dev
```

### Étape 2: Taper "Political" dans la recherche
- Observer les logs console (F12)
- Voir la réponse API: `📊 Full API Response: {...}`
- Vérifier `total_count`

### Étape 3: Analyser les logs

**Cas A - API trouve le résultat**:
```
🔍 Searching server for: Political offset: 0
📊 Full API Response: {total_count: 3, count: 3, data: [...]}
✅ Search results: 3 Total: 3
```
✅ **Pas de problème**

**Cas B - API ne trouve rien, fallback s'active**:
```
🔍 Searching server for: Political offset: 0
📊 Full API Response: {total_count: 0, count: 0, data: []}
✅ Search results: 0 Total: 0
⚠️  API retourne 0 résultats, tentative de fallback local...
🔍 Fallback: Recherche locale dans les ressources chargées...
   Résultats locaux trouvés: 5
✅ Résultats trouvés localement: 5
```
⚠️ **API est cassée, fallback active**

**Cas C - Pas de ressources chargées**:
```
⚠️  API retourne 0 résultats, tentative de fallback local...
   Résultats locaux trouvés: 0
❌ Aucun résultat trouvé
```
❌ **Vrai problème: ressource n'existe pas ou pas d'index**

---

## 📋 Checklist de Diagnostic

Copier-coller dans la console (F12):

```javascript
// Vérifier si la ressource existe
fetch('https://admin.cgiibnn-esursi.cd/api/bnn/ressource/all/', {
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        'Content-Type': 'application/json'
    }
})
.then(r => r.json())
.then(data => {
    const found = data.find(r => r.titre?.includes('Political'));
    if (found) {
        // console.log('✅ Ressource existe:', found);
    } else {
        // console.log('❌ Ressource pas trouvée');
        // console.log('Ressources avec "P":', 
            data.filter(r => r.titre?.startsWith('P')).map(r => r.titre)
        );
    }
})
.catch(e => console.error('Erreur:', e));
```

---

## 🎯 Si le Fallback Fonctionne

### Situation
- API `/ressources/search/` retourne 0
- Fallback local trouve la ressource ✅

### Cause Probable
- L'index de recherche serveur est cassé/désynchronisé
- L'endpoint `/ressources/search/` ne cherche pas partout

### Action Requise (Backend)
```bash
# Contact admin pour:
1. Vérifier l'état du service de recherche
2. Réindexer les ressources
3. Vérifier les logs de /ressources/search/
```

### Message à Envoyer
```
La recherche "Political obligations" retourne 0 résultats via /ressources/search/
mais la ressource existe dans /ressource/all/

Logs API:
- total_count: 0
- Aucune erreur 401/403
- Token valide

Demande: Réindexer ou vérifier l'état du service de recherche
```

---

## 🛠️ Si le Fallback Ne Fonctionne Pas

### Situation
- API `/ressources/search/` retourne 0
- Fallback local retourne aussi 0 ❌

### Cause Probable
- La ressource n'existe pas du tout, OU
- Son titre n'est pas "Political obligations"

### Action Requise
```javascript
// Exécuter dans la console pour trouver le titre exact:
fetch('https://admin.cgiibnn-esursi.cd/api/bnn/ressource/all/', {
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        'Content-Type': 'application/json'
    }
})
.then(r => r.json())
.then(data => {
    // console.log('Ressources avec "Political":');
    data.filter(r => r.titre?.toLowerCase().includes('political'))
        .forEach(r => // console.log('  -', r.titre, '(ID:', r.id, ')'));
});
```

---

## 📊 Tableau de Décision

| Situation | Logs | Action |
|-----------|------|--------|
| API OK, fallback OK | API: count > 0 | ✅ Pas de problème |
| API cassée, fallback OK | API: count = 0, Local: count > 0 | ⚠️ Contacter backend |
| Ressource n'existe pas | API: count = 0, Local: count = 0, mais existe en BD | ❌ Titre exact différent |
| Ressource pas en BD du tout | N/A | ❌ Vérifier avec l'ID exact |

---

## 🔐 Vérifier l'Authentification

Si les logs montrent `Error details: 401 Unauthorized`:

```javascript
// Dans la console:
// console.log('Token:', localStorage.getItem('access_token'));
// console.log('Expire:', localStorage.getItem('token_expire'));

// Si vide ou expiré:
// - Se déconnecter et reconnecter
// - Ou actualiser la page
```

---

## 📝 Fichiers Utilitaires Créés

1. **`search-diagnostic.js`** 
   - Fonctions: `testSearch()`, `findResource()`
   - À exécuter dans la console

2. **`diagnostic-console.js`**
   - Fonction: `checkIfResourceExists()`
   - Cherche dans `/ressource/all/` puis teste API

3. **`TROUBLESHOOTING_SEARCH.md`**
   - Guide complet de troubleshooting

4. **`ACTION_PLAN.md`** (ce fichier)
   - Plan d'action et checklist

---

## 🚀 Prochaines Étapes

### Immédiat
- [ ] Ouvrir l'app et chercher "Political"
- [ ] Regarder les logs (F12)
- [ ] Documenter le cas (A, B ou C)

### Si Cas A (API OK)
- [ ] Vérifier que le fallback existe
- [ ] Tester avec d'autres recherches

### Si Cas B (API Cassée)
- [ ] Contacter l'admin backend
- [ ] Donner les logs
- [ ] Demander réindexation

### Si Cas C (Pas Trouvé)
- [ ] Exécuter le diagnostic console
- [ ] Trouver le titre exact
- [ ] Vérifier que la ressource n'est pas dans un domaine privé

---

## 📞 Résumé Communication Backend

```
Objet: Recherche ne retrouve pas la ressource "Political obligations"

Détails:
- Ressource existe dans /ressource/all/
- Recherche via /ressources/search/?q=Political retourne 0 résultats
- Autres ressources sont trouvées en recherche

Logs:
[Copier les logs de la console ici]

Demande:
Réindexer les ressources ou vérifier l'état du service de recherche

Workaround Implémenté:
Une recherche locale est activée en fallback si l'API ne retourne rien
```

---

