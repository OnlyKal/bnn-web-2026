import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { FaChevronRight, FaMapMarkerAlt, FaSearch, FaTimes } from 'react-icons/fa';
import { isAuthenticated, logout } from '../utils/auth';
import provincesData from '../assets/province.json';
import RegistrationLayout from '../components/registration/RegistrationLayout';
import { countEtablissements, normalizeSearch } from '../utils/etablissements';

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

    const provinces = useMemo(() => (provincesData.provinces || [])
        .map((province) => ({ ...province, count: countEtablissements(province.nom) }))
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr')), []);

    // Recherche sans accents sur le nom, le chef-lieu ou le code.
    const filteredProvinces = useMemo(() => {
        const q = normalizeSearch(query);
        if (!q) return provinces;
        return provinces.filter((province) =>
            normalizeSearch(`${province.nom} ${province.chef_lieu} ${province.code}`).includes(q));
    }, [provinces, query]);

    return (
        <RegistrationLayout
            step={1}
            title="Où étudiez-vous ou travaillez-vous ?"
            subtitle="Choisissez la province de votre établissement : nous vous proposerons ensuite ses universités et instituts."
            back={{ label: 'Retour à la connexion', onClick: () => navigate('/login') }}
            isAuthenticated={isUserAuthenticated}
            onHome={goToHome}
            onLogout={handleLogout}
        >
            <div className="reg-toolbar">
                <label className="reg-search">
                    <FaSearch className="reg-search-icon" aria-hidden="true" />
                    <input
                        type="search"
                        aria-label="Rechercher une province"
                        placeholder="Rechercher une province ou un chef-lieu…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                    {query && (
                        <button type="button" className="reg-search-clear" onClick={() => setQuery('')} aria-label="Effacer la recherche">
                            <FaTimes aria-hidden="true" />
                        </button>
                    )}
                </label>
                <p className="reg-count" aria-live="polite">
                    {filteredProvinces.length} province{filteredProvinces.length > 1 ? 's' : ''}
                </p>
            </div>

            {filteredProvinces.length > 0 ? (
                <div className="reg-grid reg-grid-provinces">
                    {filteredProvinces.map((province) => (
                        <button
                            type="button"
                            key={province.code}
                            className="reg-option"
                            onClick={() => handleProvinceSelect(province)}
                        >
                            <span className="reg-option-icon"><FaMapMarkerAlt aria-hidden="true" /></span>
                            <span className="reg-option-text">
                                <span className="reg-option-title">{province.nom}</span>
                                <span className="reg-option-meta">
                                    <span className="reg-nowrap">Chef-lieu : {province.chef_lieu}</span>
                                    <span className="reg-count-pill">{province.count} établissement{province.count > 1 ? 's' : ''}</span>
                                </span>
                            </span>
                            <FaChevronRight className="reg-option-chevron" aria-hidden="true" />
                        </button>
                    ))}
                </div>
            ) : (
                <div className="reg-empty">
                    <FaMapMarkerAlt className="reg-empty-icon" aria-hidden="true" />
                    <h2>Aucune province trouvée</h2>
                    <p>Aucune province ne correspond à « {query} ».</p>
                    <button type="button" className="reg-btn reg-btn-outline" onClick={() => setQuery('')}>Effacer la recherche</button>
                </div>
            )}
        </RegistrationLayout>
    );
}

export default Provinces;
