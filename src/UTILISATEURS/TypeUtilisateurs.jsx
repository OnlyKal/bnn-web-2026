import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import { FaSearch, FaChalkboardTeacher, FaChevronRight, FaGraduationCap, FaUsers } from 'react-icons/fa';
import { isAuthenticated, logout } from '../utils/auth';
import RegistrationLayout from '../components/registration/RegistrationLayout';

const listeTypes = [
    { name: 'Chercheur', value: 'chercheur', description: "Recherche académique et scientifique", icon: FaSearch },
    { name: 'Étudiant', value: 'etudiant', description: "Apprentissage et études", icon: FaGraduationCap },
    { name: 'Professeur', value: 'professeur', description: "Enseignement et formation", icon: FaChalkboardTeacher },
    { name: 'Autres', value: 'autres', description: "Autres professions", icon: FaUsers }
];

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

    const summary = [
        selectedProvince && { label: 'Province', value: selectedProvince.nom, onEdit: () => navigate('/provinces') },
        selectedUniversite && { label: 'Établissement', value: selectedUniversite.nom, onEdit: goBackToUniversites }
    ].filter(Boolean);

    return (
        <RegistrationLayout
            step={3}
            title="Quel est votre profil ?"
            subtitle="Choisissez le type de compte qui vous correspond : il personnalise votre expérience sur la BNN."
            summary={summary}
            back={{ label: "Changer d'établissement", onClick: goBackToUniversites }}
            isAuthenticated={isUserAuthenticated}
            onHome={goToHome}
            onLogout={handleLogout}
        >
            <div className="reg-grid reg-grid-types">
                {listeTypes.map((type) => (
                    <button
                        type="button"
                        key={type.value}
                        className="reg-option reg-option-card"
                        onClick={() => handleTypeSelect(type)}
                    >
                        <span className="reg-option-icon reg-option-icon-lg"><type.icon aria-hidden="true" /></span>
                        <span className="reg-option-text">
                            <span className="reg-option-title">{type.name}</span>
                            <span className="reg-option-meta">{type.description}</span>
                        </span>
                        <FaChevronRight className="reg-option-chevron" aria-hidden="true" />
                    </button>
                ))}
            </div>
        </RegistrationLayout>
    );
}

export default TypeUtilisateurs;
