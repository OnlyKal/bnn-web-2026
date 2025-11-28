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
    FaTimes
} from 'react-icons/fa';
import api, { domainesAPI } from './api';
import { isAuthenticated, getCurrentUser, logout } from './utils/auth';
import { mockRessources } from './mockData';
import logoBlancImg from './assets/Logoblanc.png';
import { getMediaUrl, getFileUrl } from './config';

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

    // Fetch all resources for type filtering
    const fetchAllResources = async () => {
        try {
            const response = await api.get('/ressource/all/');
            const allResourcesData = response.data.data || [];
            console.log('All resources fetched:', allResourcesData.length);
            setAllResources(allResourcesData);
            return allResourcesData;
        } catch (error) {
            console.log('Could not fetch all resources, using paginated data:', error);
            setAllResources(ressources);
            return ressources;
        }
    };

    // Fetch domaines function
    const fetchDomaines = async () => {
        try {
            setLoadingDomaines(true);
            const response = await domainesAPI.getDomaines();
            console.log('Domaines fetched:', response);
            
            // Handle response structure
            const domainesData = response.results || response.data || response;
            setDomaines(Array.isArray(domainesData) ? domainesData : []);
            
        } catch (error) {
            console.error('Erreur lors du chargement des domaines:', error);
            setDomaines([]);
        } finally {
            setLoadingDomaines(false);
        }
    };

    // Fetch resource types function
    const fetchResourceTypes = async () => {
        try {
            setLoadingTypes(true);
            
            // Fetch ALL resources to get accurate type counts
            try {
                const response = await api.get('/ressource/all/');
                console.log('All Resources API Response:', response.data);
                
                // Extract and count types from ALL resources
                const allResources = response.data.data || [];
                const typeCounts = allResources.reduce((acc, resource) => {
                    const type = (resource.type || 'autre').toLowerCase(); // Normalize to lowercase
                    acc[type] = (acc[type] || 0) + 1;
                    return acc;
                }, {});
                
                console.log('Type counts from ALL resources:', typeCounts);
                
                // Create types array with counts
                const types = Object.entries(typeCounts).map(([type, count]) => ({
                    type: type,
                    count: count,
                    label: type.charAt(0).toUpperCase() + type.slice(1)
                }));
                
                // Add "Tous" option at the beginning
                const allCount = allResources.length;
                const typesWithAll = [
                    { type: 'all', count: allCount, label: 'Tous' },
                    ...types.sort((a, b) => a.label.localeCompare(b.label)) // Sort alphabetically
                ];
                
                console.log('Final types with counts from ALL resources:', typesWithAll);
                setResourceTypes(typesWithAll);
                
            } catch (apiError) {
                console.log('All resources API not available, using current resources:', apiError);
                
                // Fallback: use current resources to create types
                const typeCounts = ressources.reduce((acc, resource) => {
                    const type = (resource.type || 'autre').toLowerCase();
                    acc[type] = (acc[type] || 0) + 1;
                    return acc;
                }, {});
                
                const types = Object.entries(typeCounts).map(([type, count]) => ({
                    type: type,
                    count: count,
                    label: type.charAt(0).toUpperCase() + type.slice(1)
                }));
                
                const allCount = ressources.length;
                const typesWithAll = [
                    { type: 'all', count: allCount, label: 'Tous' },
                    ...types.sort((a, b) => a.label.localeCompare(b.label))
                ];
                
                setResourceTypes(typesWithAll);
            }
            
        } catch (error) {
            console.error('Erreur lors du chargement des types:', error);
            setResourceTypes([
                { type: 'all', count: ressources.length, label: 'Tous' }
            ]);
        } finally {
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

        // Fetch resources and types
        const initializeData = async () => {
            await fetchAllResources(); // Fetch all resources first
            fetchRessources(); // Then fetch paginated resources
            fetchResourceTypes(); // Finally fetch types based on all resources
            fetchDomaines(); // Fetch domaines
        };
        
        initializeData();
    }, [navigate, useMockData]);

    // Effect to refresh user data when returning to HomePage
    useEffect(() => {
        // Refresh user data whenever the location changes and we're on home
        if (location.pathname === '/home') {
            refreshUserData();
        }
    }, [location.pathname]);

    // Effect to refresh user data when page gains focus (e.g., coming back from profile)
    useEffect(() => {
        const handleFocus = () => {
            // Refresh user data when page becomes visible
            refreshUserData();
        };

        const handleVisibilityChange = () => {
            if (!document.hidden && location.pathname === '/home') {
                refreshUserData();
            }
        };

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

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('userAvatarUpdated', handleAvatarUpdate);
        window.addEventListener('userProfileUpdated', handleProfileUpdate);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('userAvatarUpdated', handleAvatarUpdate);
            window.removeEventListener('userProfileUpdated', handleProfileUpdate);
        };
    }, [location.pathname]);



    // Filter resources based on search term and type
    useEffect(() => {
        console.log('Filtering resources:', {
            totalResources: ressources.length,
            allResources: allResources.length,
            activeTypeFilter,
            searchTerm
        });
        
        // When filtering by type, we need to use allResources to get complete results
        // But if no type filter is active, use the current paginated resources
        let baseResources = ressources;
        
        if (activeTypeFilter && activeTypeFilter !== 'all' && allResources.length > 0) {
            // Use all resources for type filtering
            baseResources = allResources;
        }
        
        let filtered = [...baseResources]; // Create a copy
        
        // Filter by type first
        if (activeTypeFilter && activeTypeFilter !== 'all') {
            filtered = filtered.filter(ressource => {
                const resourceType = ressource.type || 'autre';
                const match = resourceType.toLowerCase() === activeTypeFilter.toLowerCase();
                return match;
            });
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
        
        console.log('Filtered results:', {
            baseResourcesCount: baseResources.length,
            filteredCount: filtered.length,
            activeFilter: activeTypeFilter
        });
        
        setFilteredRessources(filtered);
    }, [searchTerm, ressources, allResources, activeTypeFilter]);

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
    const handleTypeFilterChange = (type) => {
        setActiveTypeFilter(type);
    };

    // Handle domain selection
    const handleDomainSelection = async (domaine) => {
        if (selectedDomain && selectedDomain.id === domaine.id) {
            // Deselect if same domain is clicked
            setSelectedDomain(null);
            fetchRessources(); // Reload all resources
        } else {
            setSelectedDomain(domaine);
            setLoading(true);
            try {
                // Fetch resources for this specific domain
                const response = await domainesAPI.getResourcesByDomain(domaine.id);
                const ressourcesData = response.results?.data || response.data || response.results || [];
                setRessources(Array.isArray(ressourcesData) ? ressourcesData : []);
                
                // Reset pagination when filtering by domain
                setPagination({
                    next: null,
                    previous: null,
                    hasNext: false,
                    hasPrevious: false
                });
            } catch (error) {
                console.error('Erreur lors du chargement des ressources du domaine:', error);
                // Filter from all resources as fallback
                const domainResources = allResources.filter(ressource => 
                    ressource.domaine?.id === domaine.id
                );
                setRessources(domainResources);
            } finally {
                setLoading(false);
            }
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
                        />
                        {searchTerm && (
                            <button
                                className="homepage-search-clear"
                                onClick={() => setSearchTerm('')}
                                title="Effacer la recherche"
                            >
                                <FaTimes size={14} />
                            </button>
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
                                        {typeData.label}
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
                                Ressources 
                                {selectedDomain && <span className="homepage-domain-filter">- {selectedDomain.nom}</span>}
                            </h2>
                            {selectedDomain && (
                                <button 
                                    className="homepage-clear-domain-filter"
                                    onClick={() => handleDomainSelection(selectedDomain)}
                                    title="Voir toutes les ressources"
                                >
                                    ✕ Effacer le filtre
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
                                <div className="homepage-no-results-icon">📚</div>
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
                                {filteredRessources.map((ressource) => (
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

                                            {/* Informations en ligne */}
                                            <div className="homepage-resource-badges">
                                                {/* Domaine */}
                                                {ressource.domaine?.nom && (
                                                    <span className="homepage-badge homepage-badge-domain">
                                                        {ressource.domaine.nom}
                                                    </span>
                                                )}

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
                                    <FaChevronLeft size={14} />
                                    <span>Précédent</span>
                                </button>
                                
                                <button 
                                    className={`homepage-pagination-btn ${!pagination.hasNext ? 'disabled' : ''}`}
                                    onClick={handleNextPage}
                                    disabled={!pagination.hasNext}
                                    title={pagination.hasNext ? "Page suivante" : "Dernière page"}
                                >
                                    <span>Suivant</span>
                                    <FaChevronRight size={14} />
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