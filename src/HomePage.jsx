import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    FaLightbulb,
    FaExternalLinkAlt,
    FaBars,
    FaClock
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
    const [paginationInfo, setPaginationInfo] = useState({
        pageIndex: 1,         // Page number (1-based)
        totalCount: 0,        // Total items available
        pageSize: 450         // Items per page
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
    
    // Server-side search states
    const [isSearchMode, setIsSearchMode] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchPagination, setSearchPagination] = useState({
        total_count: 0,
        count: 0,
        limit: 50,
        offset: 0,
        has_next: false,
        has_previous: false
    });
    const [searchResourceTypes, setSearchResourceTypes] = useState([]);
    const searchDebounceRef = useRef(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    
    const navigate = useNavigate();
    const location = useLocation();

    // Save state to sessionStorage before navigating away
    const saveHomePageState = () => {
        const state = {
            ressources,
            searchTerm,
            filteredRessources,
            pagination,
            paginationInfo,
            resourceTypes,
            activeTypeFilter,
            allResources,
            domaines,
            selectedDomain,
            isSearchMode,
            searchResults,
            searchPagination,
            searchResourceTypes,
            timestamp: Date.now()
        };
        sessionStorage.setItem('homePageState', JSON.stringify(state));
        // console.log('💾 État de la page d\'accueil sauvegardé');
    };

    // Restore state from sessionStorage
    const restoreHomePageState = () => {
        try {
            const savedState = sessionStorage.getItem('homePageState');
            if (savedState) {
                const state = JSON.parse(savedState);
                // Check if state is not too old (5 minutes)
                if (Date.now() - state.timestamp < 5 * 60 * 1000) {
                    // console.log('♻️ Restauration de l\'état de la page d\'accueil');
                    setRessources(state.ressources || []);
                    setSearchTerm(state.searchTerm || '');
                    setFilteredRessources(state.filteredRessources || []);
                    setPagination(state.pagination || { next: null, previous: null, hasNext: false, hasPrevious: false });
                    setPaginationInfo(state.paginationInfo || { pageIndex: 1, totalCount: 0, pageSize: 450 });
                    setResourceTypes(state.resourceTypes || []);
                    setActiveTypeFilter(state.activeTypeFilter || 'all');
                    setAllResources(state.allResources || []);
                    setDomaines(state.domaines || []);
                    setSelectedDomain(state.selectedDomain || null);
                    setIsSearchMode(state.isSearchMode || false);
                    setSearchResults(state.searchResults || []);
                    setSearchPagination(state.searchPagination || { total_count: 0, count: 0, limit: 50, offset: 0, has_next: false, has_previous: false });
                    setSearchResourceTypes(state.searchResourceTypes || []);
                    setLoading(false);
                    return true;
                }
            }
        } catch (error) {
            console.error('Erreur lors de la restauration de l\'état:', error);
        }
        return false;
    };

    // Function to refresh user data
    const refreshUserData = () => {
        const currentUser = getCurrentUser();
        // console.log('Refreshing user data:', currentUser);
        setUser(currentUser);
    };

    // Helper function to simulate API delay
    const simulateApiCall = (data) => {
        return new Promise(resolve => {
            setTimeout(() => resolve(data), 500);
        });
    };

    // Server-side search function
    const performServerSearch = async (query, offset = 0) => {
        if (!query || query.trim().length < 2) {
            setIsSearchMode(false);
            setSearchResults([]);
            return;
        }

        try {
            setSearchLoading(true);
            setIsSearchMode(true);
            const trimmedQuery = query.trim();
            // console.log('🔍 Searching server for:', trimmedQuery, 'offset:', offset);
            // console.log('   Query params:', { q: trimmedQuery, limit: 50, offset: offset });

            const response = await api.get('/ressources/search/', {
                params: {
                    q: trimmedQuery,
                    limit: 50,
                    offset: offset
                }
            });

            // console.log('📊 Full API Response:', response.data);
            
            // Extract data - handle both direct array and nested structure
            const data = Array.isArray(response.data) ? response.data : (response.data.data || []);
            // console.log('✅ Extracted data:', data.length, 'items');
            // console.log('   Data types:', data.map(r => ({ id: r.id, titre: r.titre })));
            
            const pagination = {
                total_count: response.data.total_count || data.length,
                count: response.data.count || data.length,
                limit: response.data.limit || 50,
                offset: response.data.offset || offset,
                has_next: response.data.has_next || false,
                has_previous: response.data.has_previous || false
            };

            // console.log('✅ Search results:', data.length, 'Total:', pagination.total_count);
            // console.log('   Results titles:', data.map(r => r.titre).slice(0, 5));
            // console.log('   Pagination:', pagination);

            if (offset === 0) {
                setSearchResults(data);
            } else {
                setSearchResults(prev => [...prev, ...data]);
            }
            setSearchPagination(pagination);

            // Calculate type counts from search results
            const typeCounts = {};
            VALID_RESOURCE_TYPES.forEach(type => {
                typeCounts[type] = 0;
            });
            data.forEach(ressource => {
                const type = (ressource.type || '').toLowerCase().trim();
                if (typeCounts.hasOwnProperty(type)) {
                    typeCounts[type] += 1;
                }
            });
            const searchTypes = buildResourceTypesArray(typeCounts, pagination.total_count);
            setSearchResourceTypes(searchTypes);
            
            // console.log('   Type counts:', typeCounts);
        } catch (error) {
            console.error('❌ Search error:', error.message);
            console.error('   Error details:', error.response?.data || error);
            setSearchResults([]);
            setIsSearchMode(false);
        } finally {
            setSearchLoading(false);
        }
    };

    // Local search fallback - utilisé si la recherche serveur ne retourne rien
    const performLocalSearch = (query) => {
        // console.log('🔍 Fallback: Recherche locale dans les ressources chargées...');
        
        const queryLower = query.toLowerCase();
        const localResults = allResources.filter(r => {
            const titre = (r.titre || '').toLowerCase();
            const description = (r.description || '').toLowerCase();
            const domaine = (r.domaine?.nom || '').toLowerCase();
            
            return titre.includes(queryLower) || 
                   description.includes(queryLower) || 
                   domaine.includes(queryLower);
        });
        
        // console.log('   Résultats locaux trouvés:', localResults.length);
        return localResults;
    };

    // Enhanced server search with local fallback
    const performServerSearchWithFallback = async (query, offset = 0) => {
        try {
            await performServerSearch(query, offset);
            
            // Si c'est la première page et aucun résultat, essayer la recherche locale
            if (offset === 0 && searchResults.length === 0 && allResources.length > 0) {
                // console.log('⚠️  API retourne 0 résultats, tentative de fallback local...');
                const localResults = performLocalSearch(query);
                
                if (localResults.length > 0) {
                    // console.log('✅ Résultats trouvés localement:', localResults.length);
                    setSearchResults(localResults);
                    setSearchPagination({
                        total_count: localResults.length,
                        count: localResults.length,
                        limit: 50,
                        offset: 0,
                        has_next: localResults.length > 50,
                        has_previous: false
                    });
                    
                    // Recalculer les types
                    const typeCounts = {};
                    VALID_RESOURCE_TYPES.forEach(type => typeCounts[type] = 0);
                    localResults.forEach(ressource => {
                        const type = (ressource.type || '').toLowerCase().trim();
                        if (typeCounts.hasOwnProperty(type)) typeCounts[type] += 1;
                    });
                    const searchTypes = buildResourceTypesArray(typeCounts, localResults.length);
                    setSearchResourceTypes(searchTypes);
                }
            }
        } catch (error) {
            console.error('Erreur recherche serveur, fallback local:', error);
            const localResults = performLocalSearch(query);
            setSearchResults(localResults);
            setIsSearchMode(true);
        }
    };

    // Debounced search handler
    const handleSearchChange = (value) => {
        setSearchTerm(value);
        
        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current);
        }

        if (!value || value.trim().length < 2) {
            setIsSearchMode(false);
            setSearchResults([]);
            return;
        }

        searchDebounceRef.current = setTimeout(() => {
            performServerSearchWithFallback(value, 0);
        }, 500);
    };

    // Load more search results
    const handleSearchLoadMore = () => {
        const nextOffset = searchPagination.offset + searchPagination.limit;
        performServerSearch(searchTerm, nextOffset);
    };

    // Fetch all resources for type filtering (with cache - 10 min TTL)
    const fetchAllResources = async () => {
        try {
            // console.log('🔄 Fetching ALL resources from /ressource/all/...');
            const data = await cachedApiCall(
                'homepage:allResources',
                async () => {
                    try {
                        const response = await api.get('/ressource/all/');
                        // Handle different response structures
                        const allResourcesData = response.data?.data || response.data?.results || response.data || [];
                        // console.log('✅ All resources fetched from API:', allResourcesData.length, 'items');
                        return Array.isArray(allResourcesData) ? allResourcesData : [];
                    } catch (apiError) {
                        console.error('❌ /ressource/all/ failed:', apiError.message);
                        throw apiError; // Let cache handle the error
                    }
                },
                10 * 60 * 1000 // 10 minutes cache TTL
            );
            
            // console.log('✅ fetchAllResources returning:', data?.length || 0, 'resources');
            setAllResources(data);
            return data;
        } catch (error) {
            console.warn('⚠️ Could not fetch all resources from /ressource/all/:', error.message);
            // console.log('📋 Will calculate types from paginated resources instead');
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

    // Fetch resource types function - gets counts from API response
    const fetchResourceTypes = async () => {
        try {
            setLoadingTypes(true);
            
            try {
                // Fetch the main API response to get type counts
                const response = await api.get('/ressources/');
                // console.log('📊 API Response for type counts:', response.data);
                
                // Extract type counts from response
                const { typeCounts, totalCount } = extractTypeCountsFromResponse(response.data);
                
                // Build the types array for UI
                const typesWithAll = buildResourceTypesArray(typeCounts, totalCount);
                
                // console.log('🎯 Final types array:', typesWithAll);
                setResourceTypes(typesWithAll);
                
            } catch (apiError) {
                console.warn('API failed for type counts, using default structure:', apiError);
                
                // If API fails, return all types with 0 count
                const defaultTypeCounts = {};
                VALID_RESOURCE_TYPES.forEach(type => {
                    defaultTypeCounts[type] = 0;
                });
                
                const typesWithAll = buildResourceTypesArray(defaultTypeCounts, 0);
                setResourceTypes(typesWithAll);
            }
        } catch (error) {
            console.error('❌ Erreur lors du chargement des types:', error);
            
            // Fallback: return minimal types structure
            const defaultTypeCounts = {};
            VALID_RESOURCE_TYPES.forEach(type => {
                defaultTypeCounts[type] = 0;
            });
            const typesWithAll = buildResourceTypesArray(defaultTypeCounts, 0);
            setResourceTypes(typesWithAll);
        } finally {
            setLoadingTypes(false);
        }
    };

    // List of all valid resource types as per requirements
    const VALID_RESOURCE_TYPES = [
        'livre', 'monographie', 'article', 'these', 'rapport', 'revue',
        'conference', 'audio', 'video', 'image', 'podcast', 'cours',
        'presentation', 'document', 'logiciel'
    ];

    // Human-readable labels for each type (matching backend choices)
    const RESOURCE_TYPE_LABELS = {
        'livre':        'Livre',
        'monographie':  'Monographie',
        'article':      'Article',
        'these':        'Thèse / Mémoire',
        'rapport':      'Rapport',
        'revue':        'Revue',
        'conference':   'Acte de conférence',
        'audio':        'Audio',
        'video':        'Vidéo',
        'image':        'Image',
        'podcast':      'Podcast',
        'cours':        'Cours',
        'presentation': 'Présentation',
        'document':     'Document',
        'logiciel':     'Logiciel / Application',
    };

    // Function to extract and normalize type counts from API response
    const extractTypeCountsFromResponse = (responseData) => {
        // console.log('📊 Extracting type counts from API response');
        
        const typeCounts = {};
        
        // Initialize all valid types with 0
        VALID_RESOURCE_TYPES.forEach(type => {
            typeCounts[type] = 0;
        });
        
        // Override with values from API response if they exist
        VALID_RESOURCE_TYPES.forEach(type => {
            if (responseData.hasOwnProperty(type)) {
                typeCounts[type] = responseData[type];
                console.log(`✅ ${type}: ${typeCounts[type]}`);
            } else {
                console.log(`⚪ ${type}: 0 (not in response)`);
            }
        });
        
        // Get total count
        const totalCount = responseData.count || 0;
        
        return {
            typeCounts,
            totalCount
        };
    };

    // Function to build resource types array for UI
    const buildResourceTypesArray = (typeCounts, totalCount) => {
        const types = VALID_RESOURCE_TYPES.map(type => ({
            type: type,
            count: typeCounts[type] || 0,
            label: RESOURCE_TYPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1)
        }));
        
        // Add "Tous" option at the beginning
        const typesWithAll = [
            { type: 'all', count: totalCount, label: 'Tous' },
            ...types.sort((a, b) => a.label.localeCompare(b.label))
        ];
        
        return typesWithAll;
    };

    // Fetch resources function with pagination
    const fetchRessources = async (cursorUrl = null) => {
        try {
            setLoading(true);
            
            if (useMockData) {
                // Force use mock data for testing
                // console.log('Using mock data (forced)');
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
                    // console.log('API Response:', response.data);
                    
                    // Handle the nested structure: results.data instead of results
                    const ressourcesData = response.data.results?.data || response.data.results || [];
                    setRessources(ressourcesData);
                    
                    // Extract total count and page size from response
                    const totalCount = response.data.count || 0;
                    const pageSize = response.data.results?.page_size || ressourcesData.length || 450;
                    
                    // Set pagination info with total count and page size
                    setPagination({
                        next: response.data.next,
                        previous: response.data.previous,
                        hasNext: !!response.data.next,
                        hasPrevious: !!response.data.previous
                    });
                    
                    // Update pagination info (pageIndex is updated by buttons)
                    setPaginationInfo(prev => ({
                        ...prev,
                        totalCount: totalCount,
                        pageSize: pageSize
                    }));
                    
                } catch (apiError) {
                    // console.log('API not available, using mock data:', apiError);
                    
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

        // Try to restore state first
        const stateRestored = restoreHomePageState();
        
        if (!stateRestored) {
            // Only fetch if state wasn't restored
            const initializeData = async () => {
                console.time('Data Loading');
                
                // Run API calls in parallel, avoid heavy /ressource/all/ on initial load
                await Promise.all([
                    fetchRessources(),             // Get paginated resources for display
                    fetchDomaines()                // Get domaines list
                ]);
                
                console.timeEnd('Data Loading');
            };
            
            initializeData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useMockData]); // Only depend on useMockData to avoid re-fetching on every state change

    // Effect to load resource types from API
    useEffect(() => {
        // console.log('=== 🏷️ Loading resource types from API ===');
        fetchResourceTypes();
    }, []); // Run once on component mount

    // Effect to refresh user data ONLY when returning to HomePage from another page
    useEffect(() => {
        // Only refresh if we're on home path and page was just re-focused
        const onPageShow = () => {
            if (location.pathname === '/home') {
                // console.log('Page shown, refreshing user data');
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
            // console.log('Avatar updated event received:', event.detail);
            refreshUserData();
        };

        const handleProfileUpdate = (event) => {
            // Handle profile update event from Profile component
            // console.log('Profile updated event received:', event.detail);
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

    // Compute dynamic type counts based on search/domain filters
    const resourcesForTypeCounts = useMemo(() => {
        let baseResources = (allResources && allResources.length > 0) ? allResources : ressources;
        if (!baseResources || baseResources.length === 0) return [];

        let filtered = [...baseResources];

        if (selectedDomain) {
            filtered = filtered.filter(ressource => (
                ressource.domaine?.id === selectedDomain.id ||
                ressource.domaine_id === selectedDomain.id ||
                ressource.domaine?.nom?.toLowerCase() === selectedDomain.nom?.toLowerCase()
            ));
        }

        if (searchTerm && searchTerm.trim()) {
            const query = searchTerm.toLowerCase();
            filtered = filtered.filter(ressource => 
                ressource.titre?.toLowerCase().includes(query) ||
                ressource.sous_titre?.toLowerCase().includes(query) ||
                ressource.domaine?.nom?.toLowerCase().includes(query) ||
                ressource.sous_domaine?.nom?.toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [allResources, ressources, selectedDomain, searchTerm]);

    const dynamicResourceTypes = useMemo(() => {
        const typeCounts = {};
        VALID_RESOURCE_TYPES.forEach(type => {
            typeCounts[type] = 0;
        });

        resourcesForTypeCounts.forEach(ressource => {
            const resourceType = (ressource.type || '').toLowerCase().trim();
            if (typeCounts.hasOwnProperty(resourceType)) {
                typeCounts[resourceType] += 1;
            }
        });

        return buildResourceTypesArray(typeCounts, resourcesForTypeCounts.length);
    }, [resourcesForTypeCounts]);

    const shouldUseDynamicCounts = (searchTerm && searchTerm.trim()) || selectedDomain;
    const displayedResourceTypes = shouldUseDynamicCounts ? dynamicResourceTypes : resourceTypes;

    // Compute the 5 most recent resources based on date_publication
    const recentResources = useMemo(() => {
        const baseResources = (allResources && allResources.length > 0) ? allResources : ressources;
        if (!baseResources || baseResources.length === 0) return [];
        
        // Sort by date_publication descending (most recent first)
        const sorted = [...baseResources]
            .filter(r => r.date_publication) // Only include resources with a publication date
            .sort((a, b) => {
                const dateA = new Date(a.date_publication);
                const dateB = new Date(b.date_publication);
                return dateB - dateA; // Descending order
            });
        
        // Return only the 5 most recent
        return sorted.slice(0, 5);
    }, [allResources, ressources]);

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
        sessionStorage.removeItem('homePageState'); // Clear saved state on logout
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
                // Fetch resources filtered by type from API endpoint: /ressources/?type={type}
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
                
                // Reset pagination to first page
                setPaginationInfo({
                    pageIndex: 1,
                    totalCount: response.data.count || 0,
                    pageSize: 450
                });
                
                console.log(`📋 Fetched ${ressourcesData.length} resources for type "${type}"`);
            }
        } catch (error) {
            console.error(`❌ Error fetching resources for type "${type}":`, error.message);
            // console.log('📋 Falling back to all resources');
            // Fallback to all resources
            await fetchRessources();
        } finally {
            setLoading(false);
        }
    };

    const handleTypeFilterChange = (type) => {
        // console.log('🏷️ Type filter changed to:', type);
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
        // console.log('📌 Suggestion clicked:', suggestion);
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

    // Pagination handlers with page index tracking
    const handleNextPage = () => {
        if (pagination.hasNext && pagination.next) {
            // Increment page index
            setPaginationInfo(prev => ({
                ...prev,
                pageIndex: prev.pageIndex + 1
            }));
            fetchRessources(pagination.next);
        }
    };

    const handlePreviousPage = () => {
        if (pagination.hasPrevious && pagination.previous) {
            // Decrement page index but not below 1
            setPaginationInfo(prev => ({
                ...prev,
                pageIndex: Math.max(1, prev.pageIndex - 1)
            }));
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

    const handleViewResource = (ressource) => {
        saveHomePageState(); // Save state before navigation
        navigate(`/ressources/${ressource.id}`, { state: { ressource } });
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

                    <button 
                        className="homepage-burger-btn"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Menu"
                    >
                        {mobileMenuOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
                    </button>

                    <div className={`homepage-user-actions ${mobileMenuOpen ? 'open' : ''}`}>
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
                            onClick={() => { navigate('/profile'); setMobileMenuOpen(false); }}
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
                            onClick={() => { navigate('/favoris'); setMobileMenuOpen(false); }}
                        >
                            <FaHeart size={14} />
                            Favoris
                        </button>

                        <button 
                            className="homepage-portail-btn"
                            onClick={() => window.open('https://classroom.cgiibnn-esursi.cd/', '_blank')}
                            title="Accéder au Classroom"
                        >
                            <FaBook size={14} />
                            Classroom
                        </button>

                        <button 
                            className="homepage-portail-btn"
                            onClick={() => window.open('https://portail.cgiibnn-esursi.cd/', '_blank')}
                            title="Accéder au portail"
                        >
                            <FaExternalLinkAlt size={14} />
                            Portail
                        </button>
                        
                        <button 
                            className="homepage-logout-btn"
                            onClick={handleLogout}
                        >
                            <FaSignOutAlt size={14} />
                            Déconnexion
                        </button>
                    </div>
                    {/* Overlay pour fermer le menu mobile */}
                    {mobileMenuOpen && (
                        <div 
                            className="homepage-menu-overlay"
                            onClick={() => setMobileMenuOpen(false)}
                        />
                    )}
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
                            onChange={(e) => handleSearchChange(e.target.value)}
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
                        {(loadingTypes && !shouldUseDynamicCounts && !isSearchMode) ? (
                            <div className="homepage-filters-loading">
                                {[...Array(5)].map((_, index) => (
                                    <div key={index} className="homepage-filter-skeleton"></div>
                                ))}
                            </div>
                        ) : (
                            (isSearchMode ? searchResourceTypes : displayedResourceTypes).map((typeData) => (
                                <button
                                    key={typeData.type}
                                    className={`homepage-type-filter ${activeTypeFilter === typeData.type ? 'active' : ''}`}
                                    onClick={() => handleTypeFilterChange(typeData.type)}
                                >
                                    <span className="homepage-filter-label">
                                        {typeData.count > 1 && !typeData.label.endsWith('s') ? typeData.label + 's' : typeData.label}
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
                    {/* Colonne des ressources récentes (gauche) */}
                    <div className="homepage-recent-column">
                        <div className="homepage-recent-header">
                            <h2 className="homepage-section-title">
                                <FaClock className="homepage-recent-icon" />
                                Ajouts Récents
                            </h2>
                            <p className="homepage-recent-subtitle">Les 5 dernières ressources</p>
                        </div>

                        {loading && (
                            <div className="homepage-recent-loading">
                                {[...Array(5)].map((_, index) => (
                                    <div key={index} className="homepage-recent-skeleton"></div>
                                ))}
                            </div>
                        )}

                        {!loading && recentResources.length === 0 && (
                            <div className="homepage-no-recent">
                                <div className="homepage-no-recent-icon">📅</div>
                                <p>Aucune ressource récente</p>
                            </div>
                        )}

                        {!loading && recentResources.length > 0 && (
                            <div className="homepage-recent-list">
                                {recentResources.map((ressource) => (
                                    <div
                                        key={ressource.id}
                                        className="homepage-recent-item"
                                        onClick={() => {
                                            saveHomePageState();
                                            navigate(`/ressources/${ressource.id}`, { state: { ressource } });
                                        }}
                                    >
                                        <div className="homepage-recent-image">
                                            {ressource.couverture ? (
                                                <img 
                                                    src={getMediaUrl(ressource.couverture)}
                                                    alt={ressource.titre}
                                                    className="homepage-recent-img"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                        e.target.nextSibling.style.display = 'flex';
                                                    }}
                                                />
                                            ) : null}
                                            <div 
                                                className="homepage-recent-placeholder"
                                                style={{display: ressource.couverture ? 'none' : 'flex'}}
                                            >
                                                📄
                                            </div>
                                        </div>
                                        <div className="homepage-recent-info">
                                            <h4 className="homepage-recent-title">{ressource.titre}</h4>
                                            <span className="homepage-recent-date">
                                                {new Date(ressource.date_publication).toLocaleDateString('fr-FR', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                            </span>
                                            {ressource.domaine?.nom && (
                                                <span className="homepage-recent-domain">{ressource.domaine.nom}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Colonne des ressources (centre) */}
                    <div className="homepage-resources-column">
                        <div className="homepage-resources-header">
                            <h2 className="homepage-section-title">
                                {isSearchMode ? `Résultats de recherche (${searchPagination.total_count})` : 'Ressources Disponibles'}
                                {selectedDomain && !isSearchMode && <span className="homepage-domain-filter">- {selectedDomain.nom}</span>}
                            </h2>
                            <div className="homepage-header-buttons">
                                {isSearchMode && (
                                    <button 
                                        className="homepage-clear-search-btn"
                                        onClick={() => {
                                            setSearchTerm('');
                                            setIsSearchMode(false);
                                            setSearchResults([]);
                                            setActiveTypeFilter('all');
                                        }}
                                        title="Effacer la recherche"
                                    >
                                        <FaTimes /> Effacer la recherche
                                    </button>
                                )}
                                {selectedDomain && !isSearchMode && (
                                    <button 
                                        className="homepage-clear-domain-filter"
                                        onClick={() => handleDomainSelection(selectedDomain)}
                                        title="Voir toutes les ressources"
                                    >
                                        <FaTimes /> Effacer le filtre
                                    </button>
                                )}
                            </div>
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

                        {!loading && (isSearchMode ? searchResults.length === 0 : filteredRessources.length === 0) && (
                            <div className="homepage-no-results">
                                <div className="homepage-no-results-icon"><FaBook /></div>
                                <h3 className="homepage-no-results-title">
                                    {isSearchMode ? 'Aucune ressource trouvée' : selectedDomain ? `Aucune ressource dans "${selectedDomain.nom}"` : 'Aucune ressource disponible'}
                                </h3>
                                <p className="homepage-no-results-text">
                                    {isSearchMode ? 
                                        'Essayez de modifier vos critères de recherche' : 
                                        selectedDomain ?
                                        'Sélectionnez un autre domaine ou effacez le filtre' :
                                        'Les ressources seront bientôt disponibles'
                                    }
                                </p>
                            </div>
                        )}

                        {!loading && (isSearchMode ? searchResults.length > 0 : filteredRessources.length > 0) && (
                            <div className="homepage-resources-grid">
                                {(isSearchMode ? searchResults : sortedRessources).map((ressource) => (
                                    <div 
                                        key={ressource.id} 
                                        className="homepage-resource-card"
                                        onClick={() => {
                                            saveHomePageState();
                                            navigate(`/ressources/${ressource.id}`, { state: { ressource } });
                                        }}
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

                        {/* Pagination - Browse mode */}
                        {!loading && !isSearchMode && filteredRessources.length > 0 && !selectedDomain && (pagination.hasNext || pagination.hasPrevious) && (
                            <div className="homepage-pagination">
                                <button 
                                    className={`homepage-pagination-btn ${!pagination.hasPrevious ? 'disabled' : ''}`}
                                    onClick={handlePreviousPage}
                                    disabled={!pagination.hasPrevious}
                                    title={pagination.hasPrevious ? "Page précédente" : "Première page"}
                                >
                                    <FaChevronLeft size={18} />
                                </button>
                                
                                <div className="homepage-pagination-info">
                                    <span className="pagination-counter">
                                        {paginationInfo.pageIndex * paginationInfo.pageSize}/{paginationInfo.totalCount}
                                    </span>
                                </div>
                                
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

                        {/* Search pagination - Load more button */}
                        {isSearchMode && searchResults.length > 0 && !searchLoading && (
                            <div className="homepage-search-pagination">
                                <div className="homepage-search-pagination-info">
                                    <span className="pagination-counter">
                                        Affichage de {searchResults.length} sur {searchPagination.total_count} résultats
                                    </span>
                                </div>
                                {searchPagination.has_next && (
                                    <button 
                                        className="homepage-load-more-btn"
                                        onClick={handleSearchLoadMore}
                                        disabled={searchLoading}
                                    >
                                        Charger plus
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Search loading indicator */}
                        {isSearchMode && searchLoading && searchResults.length > 0 && (
                            <div className="homepage-search-loading">
                                <div className="homepage-loading-spinner"></div>
                                <p>Chargement des résultats...</p>
                            </div>
                        )}

                        {/* Info when type filter is active */}
                        {!loading && activeTypeFilter !== 'all' && (
                            <div className="homepage-filter-info">
                                <p>Affichage de {filteredRessources.length} ressource{filteredRessources.length > 1 ? 's' : ''} de type "{displayedResourceTypes.find(t => t.type === activeTypeFilter)?.label}"</p>
                                <button 
                                    className="homepage-clear-filter"
                                    onClick={() => handleTypeFilterChange('all')}
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