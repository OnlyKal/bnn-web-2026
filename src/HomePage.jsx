import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    FaSearch, 
    FaEye, 
    FaSignOutAlt,
    FaFilePdf,
    FaFileVideo,
    FaFileImage,
    FaFileAlt,
    FaTags,
    FaChevronLeft,
    FaChevronRight,
    FaHeart,
    FaTimes,
    FaBook,
    FaFileWord,
    FaBuilding,
    FaThumbtack,
    FaLightbulb
} from 'react-icons/fa';
import api, { domainesAPI } from './api';
import { isAuthenticated, getCurrentUser, logout } from './utils/auth';
import { mockRessources } from './mockData';
import logoBlancImg from './assets/Logoblanc.png';
import { getMediaUrl, getFileUrl } from './config';
import { cachedApiCall, invalidateCache } from './utils/apiCache';

const HomePage = () => {
    const [user, setUser] = useState(null);
    const [ressources, setRessources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredRessources, setFilteredRessources] = useState([]);
    const [useMockData, setUseMockData] = useState(false);
    const [pagination, setPagination] = useState({
        next: null,
        previous: null,
        hasNext: false,
        hasPrevious: false
    });
    const [resourceTypes, setResourceTypes] = useState([]);
    const [loadingTypes, setLoadingTypes] = useState(false);
    const [activeTypeFilter, setActiveTypeFilter] = useState('all');
    const [allResources, setAllResources] = useState([]); // Store all resources for filtering
    const [domaines, setDomaines] = useState([]);
    const [loadingDomaines, setLoadingDomaines] = useState(false);
    const [selectedDomain, setSelectedDomain] = useState(null);
    const [searchSuggestions, setSearchSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // Function to refresh user data
    const refreshUserData = () => {
        const currentUser = getCurrentUser();
        console.log('Refreshing user data:', currentUser);
        setUser(currentUser);
    };

    // Helper function to simulate API delay
    const simulateApiCall = (data) => {
        return new Promise(resolve => {
            setTimeout(() => resolve(data), 500);
        });
    };

    // Fetch all resources for type filtering (with cache - 10 min TTL)
    const fetchAllResources = async () => {
        try {
            console.log('🔄 Fetching ALL resources from /ressource/all/...');
            const data = await cachedApiCall(
                'homepage:allResources',
                async () => {
                    try {
                        const response = await api.get('/ressource/all/');
                        // Handle different response structures
                        const allResourcesData = response.data?.data || response.data?.results || response.data || [];
                        console.log('✅ All resources fetched from API:', allResourcesData.length, 'items');
                        return Array.isArray(allResourcesData) ? allResourcesData : [];
                    } catch (apiError) {
                        console.error('❌ /ressource/all/ failed:', apiError.message);
                        throw apiError; // Let cache handle the error
                    }
                },
                10 * 60 * 1000 // 10 minutes cache TTL
            );
            
            console.log('✅ fetchAllResources returning:', data?.length || 0, 'resources');
            setAllResources(data);
            return data;
        } catch (error) {
            console.warn('⚠️ Could not fetch all resources from /ressource/all/:', error.message);
            console.log('📋 Will calculate types from paginated resources instead');
            return []; // Return empty - will use fallback to paginated resources
        }
    };

    // Fetch domaines function (with cache - 15 min TTL)
    const fetchDomaines = async () => {
        try {
            setLoadingDomaines(true);
            const data = await cachedApiCall(
                'homepage:domaines',
                async () => {
                    const response = await domainesAPI.getDomaines();
                    // Handle response structure
                    const domainesData = response.results || response.data || response;
                    return Array.isArray(domainesData) ? domainesData : [];
                },
                15 * 60 * 1000 // 15 minutes cache TTL
            );
            
            setDomaines(data);
            return data;
            
        } catch (error) {
            console.error('Erreur lors du chargement des domaines:', error);
            setDomaines([]);
            return [];
        } finally {
            setLoadingDomaines(false);
        }
    };

    // Fetch resource types function
    const fetchResourceTypes = async () => {
        try {
            setLoadingTypes(true);
            
            // Always use allResources to get ALL available types (not just paginated ones)
            // This ensures the type filter shows all possible types
            let resourcesForTypeCounting = allResources;
            
            // If allResources is empty, try to fetch directly
            if (!resourcesForTypeCounting || resourcesForTypeCounting.length === 0) {
                try {
                    const response = await api.get('/ressource/all/');
                    console.log('All Resources API Response:', response.data);
                    
                    // Handle different response structures
                    resourcesForTypeCounting = response.data?.data || response.data?.results || response.data || [];
                } catch (apiError) {
                    console.warn('All resources API failed, attempting paginated fetch:', apiError);
                    // Last resort: use paginated resources
                    resourcesForTypeCounting = ressources;
                }
            }
            
            // Extract and count types from ALL resources
            const typeCounts = resourcesForTypeCounting.reduce((acc, resource) => {
                const type = (resource.type || 'autre').toLowerCase().trim(); // Normalize to lowercase and trim
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {});
            
            console.log('Type counts from resources:', typeCounts);
            
            // Create types array with counts
            const types = Object.entries(typeCounts).map(([type, count]) => ({
                type: type,
                count: count,
                label: type.charAt(0).toUpperCase() + type.slice(1)
            }));
            
            // Add "Tous" option at the beginning
            const allCount = resourcesForTypeCounting.length;
            const typesWithAll = [
                { type: 'all', count: allCount, label: 'Tous' },
                ...types.sort((a, b) => a.label.localeCompare(b.label)) // Sort alphabetically
            ];
            
            console.log('Final types with counts:', typesWithAll);
            setResourceTypes(typesWithAll);
            
        } catch (error) {
            console.error('Erreur lors du chargement des types:', error);
            setResourceTypes([
                { type: 'all', count: (allResources && allResources.length > 0 ? allResources.length : ressources.length), label: 'Tous' }
            ]);
        } finally {
            setLoadingTypes(false);
        }
    };

    // Function to calculate types from provided resources data (used during initialization)
    const calculateResourceTypes = (resourcesData) => {
        try {
            console.log('=== 📊 calculateResourceTypes START ===');
            console.log('Input resourcesData:', resourcesData?.length || 0, 'items');
            
            // FIXED LIST of valid types as per requirements
            const validTypes = ['Livre', 'Monographie', 'Audio', 'Vidéo', 'Image', 'Article'];
            
            // Get all resources to count types
            let resourcesForTypeCounting = null;
            let source = '';
            
            if (resourcesData && Array.isArray(resourcesData) && resourcesData.length > 0) {
                resourcesForTypeCounting = resourcesData;
                source = '📚 From /ressource/all/ (complete data)';
            } else if (ressources && ressources.length > 0) {
                resourcesForTypeCounting = ressources;
                source = '📄 From paginated resources (fallback)';
            } else {
                resourcesForTypeCounting = [];
                source = '❌ No resources available';
            }
            
            console.log(`Data source: ${source}`);
            console.log('Resources for counting:', resourcesForTypeCounting.length);
            
            if (resourcesForTypeCounting.length === 0) {
                console.warn('⚠️ No resources data available for type calculation');
                // Return all valid types with 0 count
                const typesWithAll = [
                    { type: 'all', count: 0, label: 'Tous' },
                    ...validTypes.map(type => ({
                        type: type.toLowerCase(),
                        count: 0,
                        label: type
                    }))
                ];
                setResourceTypes(typesWithAll);
                setLoadingTypes(false);
                return;
            }
            
            // Count resources for each valid type
            const typeCounts = validTypes.reduce((acc, validType) => {
                const count = resourcesForTypeCounting.filter(resource => {
                    const resourceType = (resource.type || '').toLowerCase().trim();
                    return resourceType === validType.toLowerCase();
                }).length;
                acc[validType.toLowerCase()] = count;
                return acc;
            }, {});
            
            console.log('📊 Type counts from', resourcesForTypeCounting.length, 'resources:', typeCounts);
            
            // Create types array in the order specified
            const types = validTypes.map(type => ({
                type: type.toLowerCase(),
                count: typeCounts[type.toLowerCase()] || 0,
                label: type
            }));
            
            console.log('🏷️  Types array:', types);
            
            // Add "Tous" option at the beginning
            const typesWithAll = [
                { type: 'all', count: resourcesForTypeCounting.length, label: 'Tous' },
                ...types
            ];
            
            console.log('✅ Final types with all:', typesWithAll);
            setResourceTypes(typesWithAll);
            setLoadingTypes(false);
            console.log('=== 📊 calculateResourceTypes END ===');
        } catch (error) {
            console.error('Erreur lors du calcul des types:', error);
            setResourceTypes([{ type: 'all', count: 0, label: 'Tous' }]);
            setLoadingTypes(false);
        }
    };

    // Fetch resources function with pagination
    const fetchRessources = async (cursorUrl = null) => {
        try {
            setLoading(true);
            
            if (useMockData) {
                // Force use mock data for testing
                console.log('Using mock data (forced)');
                const mockResponse = await simulateApiCall(mockRessources);
                const ressourcesData = mockResponse.results?.data || mockResponse.results || [];
                setRessources(ressourcesData);
                // Mock pagination
                setPagination({
                    next: null,
                    previous: null,
                    hasNext: false,
                    hasPrevious: false
                });
            } else {
                // Try to fetch from API first
                try {
                    let url = '/ressources/';
                    
                    // If cursorUrl is provided, extract the cursor parameter
                    if (cursorUrl) {
                        const urlObj = new URL(cursorUrl);
                        const cursor = urlObj.searchParams.get('cursor');
                        if (cursor) {
                            url = `/ressources/?cursor=${cursor}`;
                        }
                    }
                    
                    const response = await api.get(url);
                    console.log('API Response:', response.data);
                    
                    // Handle the nested structure: results.data instead of results
                    const ressourcesData = response.data.results?.data || response.data.results || [];
                    setRessources(ressourcesData);
                    
                    // Set pagination info
                    setPagination({
                        next: response.data.next,
                        previous: response.data.previous,
                        hasNext: !!response.data.next,
                        hasPrevious: !!response.data.previous
                    });
                    
                } catch (apiError) {
                    console.log('API not available, using mock data:', apiError);
                    
                    // Use mock data if API is not available
                    const mockResponse = await simulateApiCall(mockRessources);
                    const ressourcesData = mockResponse.results?.data || mockResponse.results || [];
                    setRessources(ressourcesData);
                    setPagination({
                        next: null,
                        previous: null,
                        hasNext: false,
                        hasPrevious: false
                    });
                }
            }
        } catch (error) {
            console.error('Erreur lors du chargement des ressources:', error);
            setRessources([]);
            setPagination({
                next: null,
                previous: null,
                hasNext: false,
                hasPrevious: false
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Check if user is authenticated
        if (!isAuthenticated()) {
            navigate('/login');
            return;
        }

        // Get current user data
        const currentUser = getCurrentUser();
        setUser(currentUser);

        // Fetch resources and types - PARALLELIZE all API calls
        const initializeData = async () => {
            console.time('Data Loading');
            
            // Run all API calls in parallel, not sequentially
            const [allResourcesData, paginatedResourcesData, domainesData] = await Promise.all([
                fetchAllResources(),           // Get ALL resources for types counting
                fetchRessources(),             // Get paginated resources for display
                fetchDomaines()                // Get domaines list
            ]);
            
            // Update state with the loaded data
            setAllResources(allResourcesData);
            
            console.timeEnd('Data Loading');
        };
        
        initializeData();
    }, [useMockData]); // Only depend on useMockData, not navigate

    // Separate effect to calculate types once resources are loaded
    useEffect(() => {
        console.log('=== 📋 Types calculation effect triggered ===');
        console.log('allResources available:', allResources?.length || 0);
        console.log('ressources available:', ressources?.length || 0);
        
        // PRIORITY: Use allResources from /ressource/all/ (complete dataset)
        // FALLBACK: Use paginated ressources if allResources not available
        const dataForTypes = (allResources && allResources.length > 0) ? allResources : ressources;
        
        if (dataForTypes && dataForTypes.length > 0) {
            console.log('📊 Calculating types from', dataForTypes.length, 'resources');
            console.log('Source:', allResources?.length > 0 ? '✅ allResources (/ressource/all/)' : '⚠️ ressources (paginated)');
            calculateResourceTypes(dataForTypes);
        } else {
            console.log('⚠️ No data available for type calculation yet (loading or error)');
            setResourceTypes([{ type: 'all', count: 0, label: 'Tous' }]);
        }
    }, [allResources, ressources]); // Trigger when either changes

    // Effect to refresh user data ONLY when returning to HomePage from another page
    useEffect(() => {
        // Only refresh if we're on home path and page was just re-focused
        const onPageShow = () => {
            if (location.pathname === '/home') {
                console.log('Page shown, refreshing user data');
                refreshUserData();
            }
        };

        window.addEventListener('pageshow', onPageShow);

        return () => {
            window.removeEventListener('pageshow', onPageShow);
        };
    }, []); // Empty deps - only run on mount/unmount

    // Separate effect for custom events only
    useEffect(() => {
        const handleAvatarUpdate = (event) => {
            // Handle avatar update event from Profile component
            console.log('Avatar updated event received:', event.detail);
            refreshUserData();
        };

        const handleProfileUpdate = (event) => {
            // Handle profile update event from Profile component
            console.log('Profile updated event received:', event.detail);
            refreshUserData();
        };

        window.addEventListener('userAvatarUpdated', handleAvatarUpdate);
        window.addEventListener('userProfileUpdated', handleProfileUpdate);

        return () => {
            window.removeEventListener('userAvatarUpdated', handleAvatarUpdate);
            window.removeEventListener('userProfileUpdated', handleProfileUpdate);
        };
    }, []); // Empty deps - these listeners don't need to change



    // Filter resources based on search term, type, and domain
    useEffect(() => {
        // Always use allResources as base if available, for consistent filtering
        let baseResources = (allResources && allResources.length > 0) ? allResources : ressources;
        
        // If we still don't have data, return empty
        if (!baseResources || baseResources.length === 0) {
            setFilteredRessources([]);
            return;
        }
        
        let filtered = [...baseResources]; // Create a copy
        
        // Filter by domain first (if selected)
        if (selectedDomain) {
            filtered = filtered.filter(ressource => {
                // Check if resource belongs to selected domain
                return (
                    ressource.domaine?.id === selectedDomain.id ||
                    ressource.domaine_id === selectedDomain.id ||
                    ressource.domaine?.nom?.toLowerCase() === selectedDomain.nom?.toLowerCase()
                );
            });
            console.log(`Filtered by domain "${selectedDomain.nom}": ${filtered.length} ressources`);
        }
        
        // Filter by type
        if (activeTypeFilter && activeTypeFilter !== 'all') {
            filtered = filtered.filter(ressource => {
                const resourceType = (ressource.type || '').toLowerCase().trim();
                const filterNormalized = activeTypeFilter.toLowerCase().trim();
                return resourceType === filterNormalized;
            });
            console.log(`✅ Filtered by type "${activeTypeFilter}": ${filtered.length} ressources`);
        }
        
        // Then filter by search term
        if (searchTerm && searchTerm.trim()) {
            filtered = filtered.filter(ressource => 
                ressource.titre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ressource.sous_titre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ressource.domaine?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ressource.sous_domaine?.nom?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        setFilteredRessources(filtered);
    }, [searchTerm, ressources, allResources, activeTypeFilter, selectedDomain]);

    // Sort ressources by domain, then type, then title
    const sortedRessources = [...filteredRessources].sort((a, b) => {
        // First sort by domain name
        const domainA = (a.domaine?.nom || '').toLowerCase();
        const domainB = (b.domaine?.nom || '').toLowerCase();
        if (domainA !== domainB) {
            return domainA.localeCompare(domainB);
        }
        
        // Then sort by type
        const typeA = (a.type || '').toLowerCase();
        const typeB = (b.type || '').toLowerCase();
        if (typeA !== typeB) {
            return typeA.localeCompare(typeB);
        }
        
        // Finally sort by title
        const titleA = (a.titre || '').toLowerCase();
        const titleB = (b.titre || '').toLowerCase();
        return titleA.localeCompare(titleB);
    });

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navigateToProfile = () => {
        navigate('/profile');
    };

    const navigateToProvinces = () => {
        navigate('/provinces');
    };

    // Handle type filter change
    // Fetch resources by type function using API endpoint
    const fetchResourcesByType = async (type) => {
        try {
            console.log(`🔍 Fetching resources by type: "${type}"...`);
            setLoading(true);
            
            if (type === 'all') {
                // If 'all' is selected, fetch all resources
                await fetchRessources();
            } else {
                // Fetch resources filtered by type from API endpoint /ressources/?type=...
                const response = await api.get(`/ressources/?type=${encodeURIComponent(type)}`);
                console.log(`✅ Resources fetched for type "${type}":`, response.data);
                
                // Handle the nested structure: results.data instead of results
                const ressourcesData = response.data.results?.data || response.data.results || [];
                setRessources(ressourcesData);
                
                // Set pagination info
                setPagination({
                    next: response.data.next,
                    previous: response.data.previous,
                    hasNext: !!response.data.next,
                    hasPrevious: !!response.data.previous
                });
                
                console.log(`📋 Fetched ${ressourcesData.length} resources for type "${type}"`);
            }
        } catch (error) {
            console.error(`❌ Error fetching resources for type "${type}":`, error.message);
            console.log('📋 Falling back to all resources');
            // Fallback to all resources
            await fetchRessources();
        } finally {
            setLoading(false);
        }
    };

    const handleTypeFilterChange = (type) => {
        console.log('🏷️ Type filter changed to:', type);
        setActiveTypeFilter(type);
        // Fetch resources for the selected type from API
        fetchResourcesByType(type);
    };

    // Function to generate search suggestions
    const generateSearchSuggestions = (query) => {
        if (!query || query.trim().length < 2) {
            setSearchSuggestions([]);
            return;
        }

        const lowerQuery = query.toLowerCase().trim();
        const allResourcesToSearch = (allResources && allResources.length > 0) ? allResources : ressources;
        
        if (!allResourcesToSearch || allResourcesToSearch.length === 0) {
            setSearchSuggestions([]);
            return;
        }

        // Collect unique suggestions from titles, sous-titres, domains, and sous-domaines
        const suggestionsSet = new Set();
        const suggestions = [];

        allResourcesToSearch.forEach(resource => {
            // Check titre
            if (resource.titre && resource.titre.toLowerCase().includes(lowerQuery)) {
                const titre = resource.titre.substring(0, 60) + (resource.titre.length > 60 ? '...' : '');
                if (!suggestionsSet.has(titre)) {
                    suggestionsSet.add(titre);
                    suggestions.push({
                        text: titre,
                        type: 'titre',
                        original: resource.titre,
                        iconType: 'file'
                    });
                }
            }
            
            // Check sous-titre
            if (resource.sous_titre && resource.sous_titre.toLowerCase().includes(lowerQuery)) {
                const sousTitre = resource.sous_titre.substring(0, 60) + (resource.sous_titre.length > 60 ? '...' : '');
                if (!suggestionsSet.has(sousTitre)) {
                    suggestionsSet.add(sousTitre);
                    suggestions.push({
                        text: sousTitre,
                        type: 'sous_titre',
                        original: resource.sous_titre,
                        iconType: 'clipboard'
                    });
                }
            }
            
            // Check domaine
            if (resource.domaine?.nom && resource.domaine.nom.toLowerCase().includes(lowerQuery)) {
                const domaine = resource.domaine.nom;
                if (!suggestionsSet.has(domaine)) {
                    suggestionsSet.add(domaine);
                    suggestions.push({
                        text: domaine,
                        type: 'domaine',
                        original: domaine,
                        iconType: 'building'
                    });
                }
            }
            
            // Check sous-domaine
            if (resource.sous_domaine?.nom && resource.sous_domaine.nom.toLowerCase().includes(lowerQuery)) {
                const sousDomaine = resource.sous_domaine.nom;
                if (!suggestionsSet.has(sousDomaine)) {
                    suggestionsSet.add(sousDomaine);
                    suggestions.push({
                        text: sousDomaine,
                        type: 'sous_domaine',
                        original: sousDomaine,
                        iconType: 'pin'
                    });
                }
            }
        });

        // Limit to 8 suggestions and sort by relevance (exact matches first)
        const sorted = suggestions
            .sort((a, b) => {
                const aExact = a.original.toLowerCase() === lowerQuery;
                const bExact = b.original.toLowerCase() === lowerQuery;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                return 0;
            })
            .slice(0, 8);

        console.log(`💡 Generated ${sorted.length} suggestions for query: "${query}"`);
        setSearchSuggestions(sorted);
    };

    // Effect to update suggestions when search term changes
    useEffect(() => {
        if (searchTerm.trim().length >= 2) {
            generateSearchSuggestions(searchTerm);
            setShowSuggestions(true);
        } else {
            setSearchSuggestions([]);
            setShowSuggestions(false);
        }
    }, [searchTerm, allResources, ressources]);

    // Handle suggestion click
    const handleSuggestionClick = (suggestion) => {
        console.log('📌 Suggestion clicked:', suggestion);
        setSearchTerm(suggestion.original);
        setShowSuggestions(false);
    };

    // Handle domain selection
    const handleDomainSelection = (domaine) => {
        if (selectedDomain && selectedDomain.id === domaine.id) {
            // Deselect if same domain is clicked
            setSelectedDomain(null);
        } else {
            // Just set the domain - filtering is handled by useEffect
            setSelectedDomain(domaine);
        }
    };

    // Pagination handlers
    const handleNextPage = () => {
        if (pagination.hasNext && pagination.next) {
            fetchRessources(pagination.next);
        }
    };

    const handlePreviousPage = () => {
        if (pagination.hasPrevious && pagination.previous) {
            fetchRessources(pagination.previous);
        }
    };

    // Helper function to get format icon
    const getFormatIcon = (format) => {
        switch (format?.toLowerCase()) {
            case 'pdf':
                return <FaFilePdf />;
            case 'video':
            case 'mp4':
            case 'avi':
                return <FaFileVideo />;
            case 'image':
            case 'jpg':
            case 'png':
            case 'gif':
                return <FaFileImage />;
            default:
                return <FaFileAlt />;
        }
    };

    const handleViewResource = (ressourceId) => {
        navigate(`/ressources/${ressourceId}`);
    };

    const handleDownloadResource = (ressource) => {
        if (ressource.fichiers && ressource.fichiers.length > 0) {
            // Construct full URL for the file using helper function
            const fileUrl = getFileUrl(ressource.fichiers[0].fichier);
            const link = document.createElement('a');
            link.href = fileUrl;
            link.download = ressource.fichiers[0].titre || ressource.titre;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    if (!user) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">Chargement...</p>
            </div>
        );
    }

    return (
        <div className="homepage-container">
            {/* Header */}
            <header className="homepage-header">
                <div className="homepage-header-content">
                    <div className="homepage-title-section">
                        <img 
                            src={logoBlancImg} 
                            alt="BNN ESURSI - Plateforme de ressources éducatives" 
                            className="homepage-logo"
                        />
                    </div>

                    <div className="homepage-user-actions">
                        <div className="homepage-user-info">
                            <div className="homepage-user-name">
                                {user.prenom || user.nom || user.username}
                            </div>
                            <div className="homepage-user-role">
                                {user.role} - {user.faculte}
                            </div>
                        </div>
                        
                        {/* Avatar utilisateur */}
                        <div 
                            className="homepage-user-avatar"
                            onClick={() => navigate('/profile')}
                            title="Voir mon profil"
                        >
                            {user.avatar ? (
                                <img 
                                    src={`${getMediaUrl(user.avatar)}?t=${Date.now()}`}
                                    alt={`Avatar de ${user.prenom || user.username}`}
                                    className="homepage-avatar-img"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                    }}
                                />
                            ) : null}
                            <div 
                                className="homepage-avatar-placeholder"
                                style={{display: user.avatar ? 'none' : 'flex'}}
                            >
                                {(user.prenom?.[0] || user.nom?.[0] || user.username?.[0] || 'U').toUpperCase()}
                            </div>
                        </div>
                        
                       
                        <button 
                            className="homepage-favoris-btn"
                            onClick={() => navigate('/favoris')}
                        >
                            <FaHeart size={14} />
                            Favoris
                        </button>
                        
                        <button 
                            className="homepage-logout-btn"
                            onClick={handleLogout}
                        >
                            <FaSignOutAlt size={14} />
                            Déconnexion
                        </button>
                    </div>
                </div>
            </header>

            {/* Section de recherche */}
            <section className="homepage-search-section">
                <div className="homepage-search-content">
                    <div className="homepage-search-container">
                        <FaSearch className="homepage-search-icon" />
                        <input
                            type="text"
                            className="homepage-search-input"
                            placeholder="Tapez votre recherche ici..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={() => searchTerm.length >= 2 && setShowSuggestions(true)}
                        />
                        {searchTerm && (
                            <button
                                className="homepage-search-clear"
                                onClick={() => {
                                    setSearchTerm('');
                                    setShowSuggestions(false);
                                }}
                                title="Effacer la recherche"
                            >
                                <FaTimes size={14} />
                            </button>
                        )}
                        
                        {/* Suggestions dropdown */}
                        {showSuggestions && searchSuggestions.length > 0 && (
                            <div className="homepage-search-suggestions">
                                <div className="homepage-suggestions-header">
                                    <FaLightbulb style={{ marginRight: '0.5rem' }} />
                                    Suggestions ({searchSuggestions.length})
                                </div>
                                <ul className="homepage-suggestions-list">
                                    {searchSuggestions.map((suggestion, index) => {
                                        const renderIcon = () => {
                                            switch(suggestion.iconType) {
                                                case 'file':
                                                    return <FaFileAlt size={16} />;
                                                case 'clipboard':
                                                    return <FaFileWord size={16} />;
                                                case 'building':
                                                    return <FaBuilding size={16} />;
                                                case 'pin':
                                                    return <FaThumbtack size={16} />;
                                                default:
                                                    return <FaFileAlt size={16} />;
                                            }
                                        };
                                        
                                        return (
                                            <li 
                                                key={index}
                                                className="homepage-suggestion-item"
                                                onClick={() => handleSuggestionClick(suggestion)}
                                            >
                                                <span className="suggestion-icon">{renderIcon()}</span>
                                                <span className="suggestion-text">{suggestion.text}</span>
                                                <span className="suggestion-type">
                                                    {suggestion.type === 'titre' && 'Titre'}
                                                    {suggestion.type === 'sous_titre' && 'Sous-titre'}
                                                    {suggestion.type === 'domaine' && 'Domaine'}
                                                    {suggestion.type === 'sous_domaine' && 'Sous-domaine'}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}
                    </div>
                    <div className="homepage-search-hint">
                        Recherche par titre, domaine, sous-domaine, auteur
                    </div>
                </div>
            </section>

            {/* Section des filtres par type */}
            <section className="homepage-filters-section">
                <div className="homepage-filters-content">
                    <div className="homepage-type-filters">
                        {loadingTypes ? (
                            <div className="homepage-filters-loading">
                                {[...Array(5)].map((_, index) => (
                                    <div key={index} className="homepage-filter-skeleton"></div>
                                ))}
                            </div>
                        ) : (
                            resourceTypes.map((typeData) => (
                                <button
                                    key={typeData.type}
                                    className={`homepage-type-filter ${activeTypeFilter === typeData.type ? 'active' : ''}`}
                                    onClick={() => handleTypeFilterChange(typeData.type)}
                                >
                                    <span className="homepage-filter-label">
                                        {typeData.label}{typeData.count > 0 ? 's' : ''}
                                    </span>
                                    <span className="homepage-filter-count">
                                        ({typeData.count})
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </section>

            {/* Section principale avec ressources et domaines */}
            <main className="homepage-main-section">
                <div className="homepage-main-content">
                    {/* Colonne des ressources (gauche) */}
                    <div className="homepage-resources-column">
                        <div className="homepage-resources-header">
                            <h2 className="homepage-section-title">
                                Ressources Disponible
                                {selectedDomain && <span className="homepage-domain-filter">- {selectedDomain.nom}</span>}
                            </h2>
                            {selectedDomain && (
                                <button 
                                    className="homepage-clear-domain-filter"
                                    onClick={() => handleDomainSelection(selectedDomain)}
                                    title="Voir toutes les ressources"
                                >
                                    <FaTimes /> Effacer le filtre
                                </button>
                            )}
                        </div>

                        {loading && (
                            <div className="homepage-loading-grid">
                                {[...Array(6)].map((_, index) => (
                                    <div key={index} className="homepage-loading-card">
                                        <div className="homepage-loading-image"></div>
                                        <div className="homepage-loading-content">
                                            <div className="homepage-loading-title"></div>
                                            <div className="homepage-loading-subtitle"></div>
                                            <div className="homepage-loading-badges">
                                                <div className="homepage-loading-badge"></div>
                                                <div className="homepage-loading-badge"></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!loading && filteredRessources.length === 0 && (
                            <div className="homepage-no-results">
                                <div className="homepage-no-results-icon"><FaBook /></div>
                                <h3 className="homepage-no-results-title">
                                    {searchTerm ? 'Aucune ressource trouvée' : selectedDomain ? `Aucune ressource dans "${selectedDomain.nom}"` : 'Aucune ressource disponible'}
                                </h3>
                                <p className="homepage-no-results-text">
                                    {searchTerm ? 
                                        'Essayez de modifier vos critères de recherche' : 
                                        selectedDomain ?
                                        'Sélectionnez un autre domaine ou effacez le filtre' :
                                        'Les ressources seront bientôt disponibles'
                                    }
                                </p>
                            </div>
                        )}

                        {!loading && filteredRessources.length > 0 && (
                            <div className="homepage-resources-grid">
                                {sortedRessources.map((ressource) => (
                                    <div 
                                        key={ressource.id} 
                                        className="homepage-resource-card"
                                        onClick={() => navigate(`/ressources/${ressource.id}`)}
                                    >
                                        {/* Image de couverture compacte */}
                                        <div className="homepage-resource-image">
                                            {ressource.couverture ? (
                                                <img 
                                                    src={getMediaUrl(ressource.couverture)}
                                                    alt={ressource.titre}
                                                    className="homepage-resource-img"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                        e.target.nextSibling.style.display = 'flex';
                                                    }}
                                                />
                                            ) : null}
                                            <div 
                                                className="homepage-resource-placeholder"
                                                style={{display: ressource.couverture ? 'none' : 'flex'}}
                                            >
                                                📄
                                            </div>
                                            
                                            {/* Icône de format */}
                                            <div className="homepage-format-icon">
                                                {getFormatIcon(ressource.format)}
                                            </div>
                                        </div>

                                        {/* Contenu ultra-compact */}
                                        <div className="homepage-resource-content">
                                            {/* Titre court */}
                                            <h3 className="homepage-resource-title">
                                                {ressource.titre}
                                            </h3>

                                            {/* Domaine en tant que subtitle */}
                                            {ressource.domaine?.nom && (
                                                <div className="homepage-resource-subtitle">
                                                    {ressource.domaine.nom}
                                                </div>
                                            )}

                                            {/* Informations en ligne */}
                                            <div className="homepage-resource-badges">
                                                {/* Langue */}
                                                {ressource.langue && (
                                                    <span className="homepage-badge homepage-badge-language">
                                                        {ressource.langue.toUpperCase()}
                                                    </span>
                                                )}

                                                {/* Type */}
                                                {ressource.type && (
                                                    <span className="homepage-badge homepage-badge-type">
                                                        {ressource.type}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Action rapide */}
                                            <div className="homepage-resource-action">
                                                <FaEye size={10} />
                                                <span>Voir détails</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pagination - Only show when no domain filter is active */}
                        {!loading && filteredRessources.length > 0 && !selectedDomain && (pagination.hasNext || pagination.hasPrevious) && (
                            <div className="homepage-pagination">
                                <button 
                                    className={`homepage-pagination-btn ${!pagination.hasPrevious ? 'disabled' : ''}`}
                                    onClick={handlePreviousPage}
                                    disabled={!pagination.hasPrevious}
                                    title={pagination.hasPrevious ? "Page précédente" : "Première page"}
                                >
                                    <FaChevronLeft size={18} />
                                </button>
                                
                                <button 
                                    className={`homepage-pagination-btn ${!pagination.hasNext ? 'disabled' : ''}`}
                                    onClick={handleNextPage}
                                    disabled={!pagination.hasNext}
                                    title={pagination.hasNext ? "Page suivante" : "Dernière page"}
                                >
                                    <FaChevronRight size={18} />
                                </button>
                            </div>
                        )}

                        {/* Info when type filter is active */}
                        {!loading && activeTypeFilter !== 'all' && (
                            <div className="homepage-filter-info">
                                <p>Affichage de {filteredRessources.length} ressource(s) de type "{resourceTypes.find(t => t.type === activeTypeFilter)?.label}"</p>
                                <button 
                                    className="homepage-clear-filter"
                                    onClick={() => setActiveTypeFilter('all')}
                                >
                                    Voir toutes les ressources
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Colonne des domaines (droite) */}
                    <div className="homepage-domains-column">
                        <div className="homepage-domains-header">
                            <h2 className="homepage-section-title">Domaines</h2>
                            <p className="homepage-domains-subtitle">Filtrer par domaine</p>
                        </div>

                        {loadingDomaines && (
                            <div className="homepage-domains-loading">
                                {[...Array(6)].map((_, index) => (
                                    <div key={index} className="homepage-domain-skeleton"></div>
                                ))}
                            </div>
                        )}

                        {!loadingDomaines && domaines.length === 0 && (
                            <div className="homepage-no-domains">
                                <div className="homepage-no-domains-icon">🏷️</div>
                                <p>Aucun domaine disponible</p>
                            </div>
                        )}

                        {!loadingDomaines && domaines.length > 0 && (
                            <div className="homepage-domains-list">
                                {domaines.map((domaine) => (
                                    <button
                                        key={domaine.id}
                                        className={`homepage-domain-item ${selectedDomain && selectedDomain.id === domaine.id ? 'active' : ''}`}
                                        onClick={() => handleDomainSelection(domaine)}
                                    >
                                        <div className="homepage-domain-info">
                                            <span className="homepage-domain-name">{domaine.nom}</span>
                                            {domaine.description && (
                                                <span className="homepage-domain-description">{domaine.description}</span>
                                            )}
                                        </div>
                                       
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default HomePage;