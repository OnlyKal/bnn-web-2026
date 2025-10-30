import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import { FaSearch, FaChalkboardTeacher, FaGraduationCap, FaUsers } from 'react-icons/fa';
import { isAuthenticated, logout } from '../utils/auth';

function TypeUtilisateurs() {
    const navigate = useNavigate();
    const location = useLocation();
    const selectedProvince = location.state?.selectedProvince;
    const selectedUniversite = location.state?.selectedUniversite;
    const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);

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

    const handleTypeSelect = (type) => {
        if (isUserAuthenticated) {
            // If user is authenticated, just show selection
            alert(`Type d'utilisateur sélectionné: ${type.name}`);
        } else {
            // If user is not authenticated, redirect to registration with all selected data
            // Filter out the icon component to avoid serialization issues
            const serializableUserType = {
                name: type.name,
                value: type.value,
                description: type.description
            };
            
            navigate('/register', { 
                state: { 
                    selectedProvince: selectedProvince,
                    selectedUniversite: selectedUniversite,
                    selectedUserType: serializableUserType
                } 
            });
        }
    };

    const goBackToUniversites = () => {
        navigate('/select-universite', { state: { selectedProvince } });
    };

    var listeTypes = [
        { name:'Chercheur', value:"chercheur", description: "Recherche académique et scientifique", icon: FaSearch }, 
        { name:'Professeur', value:'professeur', description: "Enseignement et formation", icon: FaChalkboardTeacher }, 
        { name: 'Etudiant(e)', value:'etudiant', description: "Apprentissage et études", icon: FaGraduationCap },
        { name:'Autres', value:'autres', description: "Autres professions", icon: FaUsers }
    ];

    return (
        <div className="user-types-page">
            {/* Header */}
            <header className="user-types-header">
                <div className="user-types-header-content">
                    <div className="user-types-title-section">
                        <h1 className="user-types-main-title">Type d'Utilisateur</h1>
                        <p className="user-types-subtitle">Sélectionnez votre profil professionnel</p>
                        
                        <div className="selection-breadcrumb">
                            {selectedProvince && (
                                <div className="selected-info">
                                    <span className="info-label">Province:</span>
                                    <span className="info-value">{selectedProvince.nom}</span>
                                </div>
                            )}
                            {selectedUniversite && (
                                <div className="selected-info">
                                    <span className="info-label">Université:</span>
                                    <span className="info-value">{selectedUniversite.nom}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="user-types-nav">
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
                                onClick={goBackToUniversites}
                                className="btn btn-outline"
                            >
                                Changer d'université
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="user-types-main">
                <div className="user-types-container">
                    <div className="user-types-intro">
                        <p className="user-types-description">
                            Choisissez le type de compte qui correspond à votre profil. 
                            Cela nous permettra de personnaliser votre expérience.
                        </p>
                    </div>

                    <div className="user-types-grid">
                        {listeTypes.map((type, index) => (
                            <div 
                                key={index} 
                                className="user-type-card"
                                onClick={() => handleTypeSelect(type)}
                            >
                                <div className="user-type-icon">
                                    <type.icon />
                                </div>
                                <div className="user-type-content">
                                    <h3 className="user-type-name">{type.name}</h3>
                                    <p className="user-type-description">{type.description}</p>
                                </div>
                                <div className="user-type-footer">
                                    <div className="select-btn">Sélectionner</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default TypeUtilisateurs;