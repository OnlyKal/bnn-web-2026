// Pour exécuter dans le navigateur console pendant que l'app est chargée

// Étape 1: Vérifier si la ressource existe dans l'endpoint /ressource/all/
async function checkIfResourceExists() {
    try {
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
        
        if (!token) {
            // // console.log('❌ Pas de token');
            return;
        }
        
        // Essayer de récupérer TOUTES les ressources
        // // console.log('📥 Récupération de toutes les ressources...');
        const response = await fetch('https://admin.cgiibnn-esursi.cd/api/bnn/ressource/all/', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const allResources = await response.json();
        // // console.log('✅ Total de ressources:', allResources.length);
        
        // Chercher "Political obligations"
        const found = allResources.find(r => 
            r.titre && r.titre.toLowerCase().includes('political')
        );
        
        if (found) {
            // console.log('✅ Ressource TROUVÉE dans /ressource/all/!');
            // console.log('   ID:', found.id);
            // console.log('   Titre:', found.titre);
            // console.log('   Domaine:', found.domaine?.nom);
            // console.log('   Type:', found.type);
            // console.log('   Objet complet:', found);
            
            // Maintenant tester si elle est trouvable par la recherche
            // console.log('\n🔍 Tentative de recherche du même titre...');
            testSearchForExactTitle(found.titre);
            
        } else {
            // console.log('❌ "Political" non trouvé dans /ressource/all/');
            // console.log('Ressources avec "Political":', 
               // allResources.filter(r => r.titre?.toLowerCase().includes('political'))
           // );
        }
        
    } catch (error) {
        console.error('Erreur:', error);
    }
}

// Étape 2: Tester la recherche avec le titre exact
async function testSearchForExactTitle(title) {
    try {
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
        
        const url = new URL('https://admin.cgiibnn-esursi.cd/api/bnn/ressources/search/');
        url.searchParams.append('q', title);
        url.searchParams.append('limit', 100);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        // console.log('Résultats de recherche pour "' + title + '":');
        // console.log('   Total trouvé:', data.total_count);
        // console.log('   Retournés:', data.count);
        
        if (data.data && data.data.length > 0) {
            const exactMatch = data.data.find(r => r.titre === title);
            if (exactMatch) {
                // console.log('✅ MATCH EXACT trouvé!');
            } else {
                // console.log('⚠️  Pas de match exact. Titres trouvés:');
               // data.data.forEach(r => // console.log('   -', r.titre));
            }
        } else {
            // console.log('❌ Aucun résultat');
        }
        
    } catch (error) {
        console.error('Erreur:', error);
    }
}

// Étape 3: Tester différentes variantes de recherche
async function testSearchVariants() {
    const queries = [
        'Political',
        'obligations',
        'Political obligations',
        'Political Obligations',
        'political obligations'
    ];
    
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    
    for (const query of queries) {
        try {
            const url = new URL('https://admin.cgiibnn-esursi.cd/api/bnn/ressources/search/');
            url.searchParams.append('q', query);
            url.searchParams.append('limit', 10);
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            console.log(`"${query}": ${data.total_count} trouvé(s), ${data.count} retourné(s)`);
            
        } catch (error) {
            console.error(`Erreur pour "${query}":`, error.message);
        }
    }
}

// À exécuter:
// console.log('=== DIAGNOSTIC RECHERCHE ===');
// console.log('Exécution: checkIfResourceExists()');
checkIfResourceExists();

// Ou après:
// testSearchVariants();
