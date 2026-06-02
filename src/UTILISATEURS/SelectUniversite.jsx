import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaSearch, FaUniversity, FaBuilding } from 'react-icons/fa';
import { isAuthenticated, logout } from '../utils/auth';
import { getAssetUrl } from '../config';
import etablissementsData from '../assets/etab_update.json';

const getSearchableText = (value) => String(value || '').toLowerCase();

const getUniversiteKey = (universite, index) => (
  universite.code ||
  universite.shortname ||
  universite.name ||
  universite.path ||
  `universite-${index}`
);

function UniversiteCard({ universite, onSelect }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const hasLogo = Boolean(universite.path) && !logoFailed;
  const shortLabel = universite.shortname || universite.code || '';

  return (
    <div
      className="universite-card"
      onClick={() => onSelect(universite)}
    >
      <div className="universite-card-header">
        <div className="universite-logo">
          {hasLogo ? (
            <img
              src={getAssetUrl(universite.path)}
              alt={`Logo ${universite.name}`}
              className="logo-image"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div className="logo-placeholder">
              <FaUniversity />
            </div>
          )}
        </div>
      </div>
      <div className="universite-card-body">
        <h3 className="universite-name">{universite.name}</h3>
        <p className="universite-details">
          <span className="universite-type">{shortLabel}</span>
        </p>
      </div>
      <div className="universite-card-footer">
        <div className="select-indicator">Cliquer pour sélectionner</div>
      </div>
    </div>
  );
}

function SelectUniversite() {
  const [query, setQuery] = useState('');
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const selectedProvince = location.state?.selectedProvince;

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

  const handleUniversiteSelect = (universite) => {
    if (isUserAuthenticated) {
      // If user is authenticated, just show selection
      alert(`Université sélectionnée: ${universite.name}`);
    } else {
      // If user is not authenticated, redirect to user types with selected province and university
      navigate('/user-types', { 
        state: { 
          selectedProvince: selectedProvince,
          selectedUniversite: {
            nom: universite.name,
            shortname: universite.shortname || universite.code || '',
            logo: universite.path
          }
        } 
      });
    }
  };

  const goBackToProvinces = () => {
    navigate('/provinces');
  };

  // Normalize a province name: remove accents, lowercase, replace spaces with hyphens
  const normalizeProv = (str) =>
    (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '-');

  // Find the matching key in etab_update.json for the selected province
  const getProvKey = (provNom) => {
    if (!provNom) return null;
    const normalized = normalizeProv(provNom);
    return Object.keys(etablissementsData).find(
      (key) => normalizeProv(key) === normalized
    ) || null;
  };

  const provKey = getProvKey(selectedProvince?.nom);
  const universites = provKey
    ? (etablissementsData[provKey] || [])
    : Object.values(etablissementsData).flat();

  const filtered = universites.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      getSearchableText(u.name).includes(q) ||
      getSearchableText(u.shortname || u.code).includes(q)
    );
  });

  return (
    <div className="universites-page">
      {/* Header */}
      <header className="universites-header">
        <div className="universites-header-content">
          <div className="universites-title-section">
            <h1 className="universites-main-title">Sélection d'Université</h1>
            <p className="universites-subtitle">Choisissez votre établissement d'enseignement</p>
            
            <div className="selection-breadcrumb">
              {selectedProvince && (
                <div className="selected-info">
                  <span className="info-label">Province:</span>
                  <span className="info-value">{selectedProvince.nom}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="universites-nav">
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
                onClick={goBackToProvinces}
                className="btn btn-outline"
              >
                Changer de province
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="universites-main">
        <div className="universites-container">
          {/* Search Section */}
          <div className="universites-search-section">
            <div className="universites-search-container">
              <input
                aria-label="Rechercher une université"
                className="universites-search-input"
                placeholder="Rechercher par nom d'établissement ou sigle..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="universites-search-icon">
                <FaSearch />
              </div>
            </div>
            <p className="universites-search-hint">
              {filtered.length} établissement{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
            </p>
          </div>

          {/* Universites Grid */}
          <div className="universites-grid">
            {filtered.map((u, index) => (
              <UniversiteCard
                key={getUniversiteKey(u, index)}
                universite={u}
                onSelect={handleUniversiteSelect}
              />
            ))}

            {filtered.length === 0 && (
              <div className="universites-no-results">
                <div className="no-results-icon">
                  <FaBuilding />
                </div>
                <h3>Aucun établissement trouvé</h3>
                <p>Essayez de modifier votre recherche</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default SelectUniversite;
