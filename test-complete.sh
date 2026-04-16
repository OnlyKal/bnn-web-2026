#!/bin/bash
# Script de test complet pour la recherche "Political obligations"
# Usage: bash test-complete.sh

set -e

echo "=================================================================================="
echo "🧪 TEST COMPLET - Recherche 'Political Obligations'"
echo "=================================================================================="
echo ""

# Test 1: Vérifier que le code compile
echo "1️⃣  Vérification compilation..."
npm run build > /tmp/build.log 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Build réussi"
else
    echo "❌ Build échoué"
    cat /tmp/build.log | tail -20
    exit 1
fi
echo ""

# Test 2: Vérifier qu'il n'y a pas d'erreurs d'import
echo "2️⃣  Vérification imports..."
grep -n "performServerSearchWithFallback\|performLocalSearch" src/HomePage.jsx > /tmp/imports.log
if [ $? -eq 0 ]; then
    echo "✅ Fonctions trouvées:"
    cat /tmp/imports.log
else
    echo "❌ Fonctions non trouvées"
    exit 1
fi
echo ""

# Test 3: Vérifier que les logs sont présents
echo "3️⃣  Vérification logs améliorés..."
grep -n "📊 Full API Response" src/HomePage.jsx > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Logs améliorés présents"
else
    echo "❌ Logs non trouvés"
    exit 1
fi
echo ""

# Test 4: Vérifier que le fallback est utilisé
echo "4️⃣  Vérification fallback..."
grep -n "performServerSearchWithFallback" src/HomePage.jsx | grep -v "const\|function" > /tmp/fallback.log
if [ $(wc -l < /tmp/fallback.log) -gt 0 ]; then
    echo "✅ Fallback appelé:"
    cat /tmp/fallback.log
else
    echo "❌ Fallback non appelé"
    exit 1
fi
echo ""

# Test 5: Vérifier la syntaxe React
echo "5️⃣  Vérification syntaxe React..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Syntaxe valide"
else
    echo "❌ Erreur syntaxe"
    exit 1
fi
echo ""

echo "=================================================================================="
echo "✅ TOUS LES TESTS SONT PASSÉS"
echo "=================================================================================="
echo ""
echo "Prochaines étapes:"
echo "1. npm run dev"
echo "2. Chercher 'Political' dans l'app"
echo "3. F12 → Console"
echo "4. Vérifier les logs"
echo ""
echo "Logs à regarder:"
echo "  🔍 Searching server for: ..."
echo "  📊 Full API Response: ..."
echo "  ⚠️  API retourne 0 (si fallback se déclenche)"
echo "  ✅ Résultats trouvés localement: X (si fallback trouve)"
echo ""
echo "Documentation: Voir DOCUMENTATION_INDEX.md"
echo ""
