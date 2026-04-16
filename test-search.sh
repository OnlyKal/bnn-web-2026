#!/bin/bash

# Script de test pour la recherche API
# Usage: bash test-search.sh

API_URL="https://admin.cgiibnn-esursi.cd/api/bnn"

echo "========================================="
echo "🧪 TEST RECHERCHE API"
echo "========================================="
echo ""

# Test 1: Rechercher "Political"
echo "Test 1️⃣ : Recherche 'Political obligations'"
curl -s "${API_URL}/ressources/search/?q=Political%20obligations&limit=50&offset=0" \
  -H "Content-Type: application/json" | jq '.' > /tmp/search_result.json

echo "Réponse reçue:"
cat /tmp/search_result.json | jq '.total_count, .count, .data | length'
echo ""

# Afficher les résultats trouvés
echo "📊 Résultats trouvés:"
cat /tmp/search_result.json | jq '.data[] | {id, titre, domaine, type}' | head -20
echo ""

# Test 2: Recherche avec "Political" seul
echo ""
echo "Test 2️⃣ : Recherche 'Political'"
curl -s "${API_URL}/ressources/search/?q=Political&limit=50&offset=0" \
  -H "Content-Type: application/json" | jq '.total_count, .count, .data | length'
echo ""

# Test 3: Recherche avec "obligations" seul
echo ""
echo "Test 3️⃣ : Recherche 'obligations'"
curl -s "${API_URL}/ressources/search/?q=obligations&limit=50&offset=0" \
  -H "Content-Type: application/json" | jq '.total_count, .count, .data | length'
echo ""

echo "========================================="
echo "✅ Tests complétés"
echo "Vérifier /tmp/search_result.json pour plus de détails"
echo "========================================="
