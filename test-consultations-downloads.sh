#!/bin/bash

echo "🧪 Test API Consultations & Téléchargements"
echo "=========================================="
echo ""

RESSOURCE_ID=25
BASE_URL="http://localhost:8000/api/bnn"

echo "1. 📖 Test Consultation (POST /consultations/)"
echo "   Ressource ID: $RESSOURCE_ID"
echo "   URL: $BASE_URL/consultations/"
CONSULTATION_RESPONSE=$(curl -X POST $BASE_URL/consultations/ \
  -H "Content-Type: application/json" \
  -d "{\"ressource_id\": $RESSOURCE_ID}" \
  -s -w "HTTP_STATUS:%{http_code}")

HTTP_CODE_CONSULT=$(echo "$CONSULTATION_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d':' -f2)
BODY_CONSULT=$(echo "$CONSULTATION_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "   Réponse: $BODY_CONSULT"
echo "   Code HTTP: $HTTP_CODE_CONSULT"
echo ""

echo "2. 📥 Test Téléchargement (POST /downloads/)"
echo "   Ressource ID: $RESSOURCE_ID"
echo "   URL: $BASE_URL/downloads/"
DOWNLOAD_RESPONSE=$(curl -X POST $BASE_URL/downloads/ \
  -H "Content-Type: application/json" \
  -d "{\"ressource_id\": $RESSOURCE_ID}" \
  -s -w "HTTP_STATUS:%{http_code}")

HTTP_CODE_DOWNLOAD=$(echo "$DOWNLOAD_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d':' -f2)
BODY_DOWNLOAD=$(echo "$DOWNLOAD_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "   Réponse: $BODY_DOWNLOAD"
echo "   Code HTTP: $HTTP_CODE_DOWNLOAD"
echo ""

echo "📊 Résumé:"
if [ "$HTTP_CODE_CONSULT" = "200" ] || [ "$HTTP_CODE_CONSULT" = "201" ]; then
    echo "   ✅ Consultation API: Fonctionne"
else
    echo "   ❌ Consultation API: Erreur ($HTTP_CODE_CONSULT)"
fi

if [ "$HTTP_CODE_DOWNLOAD" = "200" ] || [ "$HTTP_CODE_DOWNLOAD" = "201" ]; then
    echo "   ✅ Téléchargement API: Fonctionne"
else
    echo "   ❌ Téléchargement API: Erreur ($HTTP_CODE_DOWNLOAD)"
fi

echo ""
echo "🎯 Intégration dans RessourceDetails.jsx:"
echo "   - Bouton 'Ouvrir' → POST /consultations/ ✅"
echo "   - Bouton 'Télécharger' → POST /downloads/ ✅"
echo ""
echo "🏁 Test terminé!"