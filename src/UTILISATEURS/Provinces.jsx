import React, { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { FaMapMarkerAlt, FaSearch } from 'react-icons/fa';
import { isAuthenticated, logout } from '../utils/auth';
import provincesData from '../assets/province.json';

const getSearchableText = (value) => String(value || '').toLowerCase();

function Provinces() {
    const navigate = useNavigate();
    const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);
    const [query, setQuery] = useState('');

    // Check authentication status
    useEffect(() => {
        setIsUserAuthenticated(isAuthenticated());
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const goToHome = () => {
        navigate('/home');
    };

    const handleProvinceSelect = (province) => {
        if (isUserAuthenticated) {
            // If user is authenticated, just show selection
            alert(`Province sélectionnée: ${province.nom}`);
        } else {
            // If user is not authenticated, redirect to select university with selected province
            navigate('/select-universite', { state: { selectedProvince: province } });
        }
    };

    const provinces = provincesData.provinces || [];
    
    // Filter provinces based on search query
    const filteredProvinces = provinces.filter((province) => {
        const searchQuery = query.trim().toLowerCase();
        if (!searchQuery) return true;
        return (
            getSearchableText(province.nom).includes(searchQuery) ||
            getSearchableText(province.chef_lieu).includes(searchQuery) ||
            getSearchableText(province.code).includes(searchQuery)
        );
    });

    return (
        <div className="provinces-page">
            {/* Header */}
            <header className="provinces-header">
                <div className="provinces-header-content">
                    <div className="provinces-title-section">
                        <h1 className="provinces-main-title">Sélection de Province</h1>
                        <p className="provinces-subtitle">Choisissez votre province de résidence</p>
                    </div>
                    
                    <div className="provinces-nav">
                        {isUserAuthenticated ? (
                            <>
                                <button 
                                    onClick={goToHome}
                                    className="btn btn-primary"
                                >
                                    Accueil
                                </button>
                                <button 
                                    onClick={handleLogout}
                                    className="btn btn-danger"
                                >
                                    Déconnexion
                                </button>
                            </>
                        ) : (
                            <button 
                                onClick={() => navigate('/login')}
                                className="btn btn-outline"
                            >
                                Retour à la connexion
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="provinces-main">
                <div className="provinces-container">
                    <div className="provinces-intro">
                        <p className="provinces-description">
                            Sélectionnez votre province de résidence. Cette information nous permettra 
                            de vous proposer les établissements d'enseignement disponibles dans votre région.
                        </p>
                    </div>

                    {/* Search Section */}
                    <div className="provinces-search-section">
                        <div className="provinces-search-container">
                            <input
                                aria-label="Rechercher une province"
                                className="provinces-search-input"
                                placeholder="Rechercher par nom, chef-lieu ou code..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                            <div className="provinces-search-icon">
                                <FaSearch />
                            </div>
                        </div>
                        <p className="provinces-search-hint">
                            {filteredProvinces.length} province{filteredProvinces.length > 1 ? 's' : ''} trouvée{filteredProvinces.length > 1 ? 's' : ''}
                        </p>
                    </div>

                    <div className="provinces-grid">
                        {filteredProvinces.map((province) => (
                            <div 
                                key={province.code} 
                                className="province-card"
                                onClick={() => handleProvinceSelect(province)}
                            >
                                <div className="province-icon">
                                    <FaMapMarkerAlt />
                                </div>
                                <div className="province-content">
                                    <h3 className="province-name">{province.nom}</h3>
                                    <p className="province-description">Chef-lieu: {province.chef_lieu}</p>
                                </div>
                                <div className="province-footer">
                                    <div className="select-btn">Sélectionner</div>
                                </div>
                            </div>
                        ))}

                        {filteredProvinces.length === 0 && (
                            <div className="no-results">
                                <div className="no-results-icon">
                                    <FaMapMarkerAlt />
                                </div>
                                <p>Aucune province trouvée pour "{query}"</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Provinces;
