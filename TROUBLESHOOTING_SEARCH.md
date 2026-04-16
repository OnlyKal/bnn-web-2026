# 🔍 DIAGNOSTIC - Ressource "Political obligations" non trouvée

**Date**: 19 février 2026
**Problème**: Ressource existe dans la BD mais ne s'affiche pas en recherche

---

## 📋 Diagnostiquer le Problème

Le problème peut venir de plusieurs sources:

### 1️⃣ **Vérifier que la ressource existe réellement**
```javascript
// Dans la console du navigateur (app doit être ouverte + connecté):
// Copier-coller le contenu de diagnostic-console.js
checkIfResourceExists();
```

Cela va:
- ✅ Récupérer TOUTES les ressources via `/ressource/all/`
- ✅ Chercher si "Political" existe
- ✅ Si trouvé, tester la recherche avec le titre exact

**Résultats possibles**:
- ✅ **Trouvé dans `/ressource/all/` mais PAS en recherche** → Problème d'indexation serveur
- ✅ **Trouvé dans les deux** → Le problème a été réglé
- ❌ **Pas trouvé du tout** → La ressource n'existe pas ou a été supprimée

---

### 2️⃣ **Tester les variantes de recherche**
```javascript
// Si la ressource existe mais n'est pas trouvée, tester:
testSearchVariants();
```

Cela teste:
- `Political`
- `obligations`
- `Political obligations` (exact)
- `Political Obligations` (caps)
- `political obligations` (lowercase)

**Si une variante fonctionne** → Le problème est sensibilité casse/espace

---

### 3️⃣ **Vérifier les logs de l'app**
Ouvrir la **Console du navigateur** (F12):
```
🔍 Searching server for: Political obligations offset: 0
📊 Full API Response: {...}
✅ Search results: 0 Total: 0
```

**Vérifications**:
- Le paramètre `q` est correct (sans espaces excessifs)
- La réponse `total_count` est 0 → Endpoint ne retourne rien
- Pas d'erreur 403/401 → Authentification OK

---

## 🛠️ Solutions Possibles

### **Scénario A: Ressource existe mais ne s'indexe pas**

**Cause**: L'API `/ressources/search/` utilise une base de données inversée (Elasticsearch, Solr, etc.) qui n'est pas synchronisée

**Solution**:
```bash
# 1. Contacter l'admin backend pour:
   - Réindexer les ressources
   - Ou redémarrer le service de recherche
   - Ou vérifier qu'un cron indexe régulièrement

# 2. Vérifier les logs serveur:
   /var/log/django.log
   /var/log/elasticsearch.log  (si utilisé)
```

---

### **Scénario B: L'API cherche dans un champ spécifique**

**Cause**: L'API cherche uniquement dans `titre`, pas dans `description` ou autres champs

**Solution à tester** (dans console):
```javascript
// Chercher avec juste "Political"
testSearch('Political');

// Si ça fonctionne, tester:
testSearch('Polit');  // Pas de "obligations"
```

**Si "Political" seul fonctionne**:
→ Le serveur cherche par mot-clé
→ Peut-être que "obligations" doit être cherché séparément
→ Ou l'indexation est partielle

---

### **Scénario C: Problème de permissions/filtrage**

**Cause**: Certaines ressources sont filtrées (domaine, type, status publié)

**Vérifier**: 
```javascript
// Lors de checkIfResourceExists(), regarder les champs:
// - domaine (est-il publié?)
// - type (est-il filtré?)
// - status (est-il publié/actif?)
// - user_permissions (accès restreint?)
```

---

## 📊 Étapes de Troubleshooting

**Étape 1**: Ouvrir la Console du navigateur (F12)
**Étape 2**: Copier le contenu de `diagnostic-console.js`
**Étape 3**: Exécuter: `checkIfResourceExists();`
**Étape 4**: Analyser les logs:

| Résultat | Action |
|----------|--------|
| Ressource trouvée dans `/ressource/all/` mais pas en recherche | Contact backend pour réindexation |
| Ressource pas trouvée du tout | Vérifier l'ID/titre exact |
| Trouvée dans les 2 endpoints | ✅ Problème résolu |
| Erreur 401/403 | Vérifier le token d'authentification |

---

## 🔧 Corrections Potentielles Frontend

Si le problème vient du frontend (paramètres mal formés):

**Vérifier dans `performServerSearch()`**:
```javascript
// ✅ Actuel (correct):
params: {
    q: query.trim(),
    limit: 50,
    offset: offset
}

// ⚠️ Problème possible - trop de nettoyage:
// Essayer de passer directement sans trim() excessif
```

**Ajouter du debug**:
```javascript
// console.log('Paramètres finaux:', {
    q: query.trim(),
    limit: 50,
    offset: offset
});
```

---

## 📝 Logs À Regarder

**Dans la console navigateur après recherche**:
```
🔍 Searching server for: Political obligations offset: 0
   Query params: {q: 'Political obligations', limit: 50, offset: 0}
📊 Full API Response: {
    total_count: ???,    // 0 = pas trouvé, >0 = OK
    count: ???,
    data: [...]
}
```

**Clé d'interprétation**:
- `total_count: 0` = Aucun résultat → Problème serveur
- `count: 0` mais `total_count: 0` = Pas d'erreur, juste pas trouvé
- Erreur dans `Full API Response` = Problème de requête

---

## 🎯 Prochaines Étapes

1. ✅ **Exécuter le diagnostic**: `checkIfResourceExists()`
2. ✅ **Documenter les résultats**: Copier les logs
3. ✅ **Si problème confirmé**: Contacter l'admin backend avec preuves
4. ✅ **Améliorer la recherche**: 
   - Ajouter suggestions/autocomplete
   - Implémenter fallback sur `/ressource/all/` si API échoue
   - Ajouter filtres multichamps

---

## 📞 Contact Backend

Si la réindexation est nécessaire, fournir:
```
Endpoint: /ressources/search/
Terme testé: "Political obligations"
Résultat: total_count: 0, mais existe dans /ressource/all/
Action requise: Réindexer ou vérifier le service de recherche
```

---
