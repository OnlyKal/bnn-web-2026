#!/bin/bash

echo "🧪 Test complet de l'API Reset Password"
echo "======================================"

echo ""
echo "1. 🔑 Test de connexion pour obtenir un token valide..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8000/api/bnn/user/signin/ \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}')

echo "Réponse de connexion: $LOGIN_RESPONSE"

# Extraire le token de la réponse (si elle existe)
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Impossible d'obtenir un token valide"
    echo "💡 Essayons avec des identifiants différents..."
    
    # Essayer avec l'email fourni
    LOGIN_RESPONSE2=$(curl -s -X POST http://localhost:8000/api/bnn/user/signin/ \
        -H "Content-Type: application/json" \
        -d '{"username":"bihangojustin@gmail.com","password":"password123"}')
    
    echo "Réponse de connexion 2: $LOGIN_RESPONSE2"
    TOKEN=$(echo "$LOGIN_RESPONSE2" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ]; then
    echo "❌ Aucun token valide trouvé"
    echo "🔧 Test de l'API sans authentification..."
    
    echo ""
    echo "2. 🧪 Test Reset Password SANS token..."
    RESET_RESPONSE=$(curl -s -X PUT http://localhost:8000/api/bnn/user/password-reset/ \
        -H "Content-Type: application/json" \
        -d '{"email":"bihangojustin@gmail.com"}' \
        -w "\nHTTP_STATUS:%{http_code}")
    
    echo "Réponse: $RESET_RESPONSE"
else
    echo "✅ Token obtenu: ${TOKEN:0:20}..."
    
    echo ""
    echo "2. 🧪 Test Reset Password AVEC token..."
    RESET_RESPONSE=$(curl -s -X PUT http://localhost:8000/api/bnn/user/password-reset/ \
        -H "Content-Type: application/json" \
        -H "Authorization: Token $TOKEN" \
        -d '{"email":"bihangojustin@gmail.com"}' \
        -w "\nHTTP_STATUS:%{http_code}")
    
    echo "Réponse: $RESET_RESPONSE"
fi

echo ""
echo "3. 📋 Résumé des endpoints disponibles:"
curl -s http://localhost:8000/api/bnn/ 2>/dev/null | grep -o "user/[^<]*" | sort | uniq

echo ""
echo "🏁 Test terminé!"