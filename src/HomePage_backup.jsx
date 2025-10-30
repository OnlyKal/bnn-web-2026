import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FaSearch, 
    FaEye, 
    FaSignOutAlt,
    FaFilePdf,
    FaFileVideo,
    FaFileImage,
    FaFileAlt,
    FaTags
} from 'react-icons/fa';
import api from './api';
import { isAuthenticated, getCurrentUser, logout } from './UTILISATEURS/Connexion';
import { mockRessources } from './mockData';

const HomePage = () => {
    const [user, setUser] = useState(null);
    const [ressources, setRessources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredRessources, setFilteredRessources] = useState([]);
    const [useMockData, setUseMockData] = useState(false);
    const navigate = useNavigate();

    // Helper function to simulate API delay
    const simulateApiCall = (data) => {
        return new Promise(resolve => {
            setTimeout(() => resolve(data), 500);
        });
    };

    // Fetch resources function
    const fetchRessources = async () => {
        try {
            setLoading(true);
            
            if (useMockData) {
                // Force use mock data for testing
                console.log('Using mock data (forced)');
                const mockResponse = await simulateApiCall(mockRessources);
                const ressourcesData = mockResponse.results?.data || mockResponse.results || [];
                setRessources(ressourcesData);
            } else {
                // Try to fetch from API first
                try {
                    const response = await api.get('/ressources/');
                    console.log('API Response:', response.data);
                    
                    // Handle the nested structure: results.data instead of results
                    const ressourcesData = response.data.results?.data || response.data.results || [];
                    setRessources(ressourcesData);
                } catch (apiError) {
                    console.log('API not available, using mock data:', apiError);
                    
                    // Use mock data if API is not available
                    const mockResponse = await simulateApiCall(mockRessources);
                    // Handle both structures: mockData has results.data, real API might have results directly
                    const ressourcesData = mockResponse.results?.data || mockResponse.results || [];
                    setRessources(ressourcesData);
                }
            }
        } catch (error) {
            console.error('Erreur lors du chargement des ressources:', error);
            setRessources([]);
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

        // Fetch resources
        fetchRessources();
    }, [navigate, useMockData]);

    // Filter resources based on search term
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredRessources(ressources);
        } else {
            const filtered = ressources.filter(ressource => 
                ressource.titre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ressource.sous_titre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ressource.domaine?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ressource.sous_domaine?.nom?.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredRessources(filtered);
        }
    }, [searchTerm, ressources]);

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
            // Construct full URL for the file
            const fileUrl = `http://localhost:8000${ressource.fichiers[0].fichier}`;
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
                        <h1>BNN ESURSI</h1>
                        <p className="homepage-subtitle">
                            Plateforme de ressources éducatives
                        </p>
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
                        
                        {/* Toggle pour tester les données */}
                        <div className="homepage-toggle-section">
                            <span className="homepage-toggle-label">
                                {useMockData ? 'Mock' : 'API'}
                            </span>
                            <button
                                className={`homepage-toggle-btn ${useMockData ? 'active' : ''}`}
                                onClick={() => {
                                    setUseMockData(!useMockData);
                                    // Reload resources when switching
                                    setTimeout(() => fetchRessources(), 100);
                                }}
                            >
                                Switch
                            </button>
                        </div>
                        
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

            {/* Section de bienvenue */}
            <section className="homepage-welcome">
                <div className="homepage-welcome-content">
                    <h2 className="homepage-welcome-title">
                        Bienvenue, {user.prenom || user.username} !
                    </h2>
                    <p className="homepage-welcome-text">
                        Découvrez nos ressources académiques et éducatives
                    </p>
                </div>
            </section>

            {/* Section de recherche */}
            <section className="homepage-search-section">
                <div className="homepage-search-content">
                    <div className="homepage-search-container">
                        <FaSearch className="homepage-search-icon" />
                        <input
                            type="text"
                            className="homepage-search-input"
                            placeholder="Rechercher des ressources..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </section>

            {/* Section des ressources */}
            <main className="homepage-resources-section">
                <div className="homepage-resources-content">
                    {loading && (
                        <div className="homepage-loading-grid">
                            {[...Array(8)].map((_, index) => (
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
                                {searchTerm ? 'Aucune ressource trouvée' : 'Aucune ressource disponible'}
                            </h3>
                            <p className="homepage-no-results-text">
                                {searchTerm ? 
                                    'Essayez de modifier vos critères de recherche' : 
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
                                                src={`http://localhost:8000${ressource.couverture}`}
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
                </div>
            </main>
        </div>
    );
};

export default HomePage;