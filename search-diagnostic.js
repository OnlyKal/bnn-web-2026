// Diagnostic Script - À exécuter dans la console du navigateur
// Utilisé pour tester la recherche API

async function testSearch(query) {
    try {
        // Récupérer le token du localStorage
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
        
        // console.log('🔍 Test de recherche pour:', query);
        // console.log('Token présent:', !!token);
        
        if (!token) {
            console.warn('⚠️ Pas de token trouvé dans localStorage');
            return;
        }
        
        const url = new URL('https://admin.cgiibnn-esursi.cd/api/bnn/ressources/search/');
        url.searchParams.append('q', query);
        url.searchParams.append('limit', 50);
        url.searchParams.append('offset', 0);
        
        // console.log('📡 URL appelée:', url.toString());
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        // console.log('✅ Status:', response.status);
        
        const data = await response.json();
        // console.log('📊 Réponse complète:', data);
        // console.log('   Total trouvé:', data.total_count);
        // console.log('   Résultats retournés:', data.count);
        
        if (data.data && data.data.length > 0) {
            // console.log('📋 Premiers résultats:');
            data.data.slice(0, 5).forEach(item => {
                // console.log('   -', item.titre);
            });
        } else {
            // console.log('❌ Aucun résultat trouvé');
        }
        
        return data;
        
    } catch (error) {
        console.error('❌ Erreur:', error);
    }
}

// Fonction pour chercher une ressource spécifique
async function findResource(title) {
    // console.log('🔎 Recherche de ressource:', title);
    const result = await testSearch(title);
    
    if (result && result.data) {
        const found = result.data.find(r => 
            r.titre.toLowerCase().includes(title.toLowerCase())
        );
        
        if (found) {
            // console.log('✅ Ressource trouvée!');
            console.log(found);
            return found;
        } else {
            // console.log('❌ Ressource non trouvée dans les résultats');
            // Afficher ce qui a été trouvé
            // console.log('Titres trouvés:');
            result.data.forEach(r => // console.log('   -', r.titre));
        }
    }
}

// Utilisation:
// testSearch('Political');
// testSearch('Political obligations');
// findResource('Political obligations');

// console.log('✅ Diagnostic chargé. Tapez: testSearch("Political") ou testSearch("Political obligations")');
