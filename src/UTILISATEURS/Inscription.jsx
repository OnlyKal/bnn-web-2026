import React, { useState } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import {
    FaExclamationTriangle,
    FaUser,
    FaEnvelope,
    FaLock,
    FaPhone,
    FaVenusMars,
    FaCalendarAlt,
    FaGraduationCap,
    FaClipboardList,
    FaIdCard,
    FaCheckCircle,
    FaTimesCircle
} from 'react-icons/fa';
import { authAPI, validators } from '../api';
import { saveSession } from '../utils/auth';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ToastContainer';

function Inscription() {
    const navigate = useNavigate();
    const location = useLocation();
    const selectedProvince = location.state?.selectedProvince;
    const selectedUserType = location.state?.selectedUserType;
    const selectedUniversite = location.state?.selectedUniversite;

    const [formData, setFormData] = useState({
        username: '',
        nom: '',
        prenom: '',
        password: '',
        confirmPassword: '',
        email: '',
        telephone: '',
        sexe: '',
        date_naissance: '',
        faculte: ''
    });

    const [loading, setLoading] = useState(false);
    const { toasts, removeToast, showError, showSuccess } = useToast();

    const goToLogin = () => {
        navigate('/login');
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        console.log(`Champ ${name} changé à:`, value);
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const validateForm = () => {
        // Required fields validation
        if (!validators.validateRequired(formData.username)) return "Le nom d'utilisateur est requis";
        if (!validators.validateRequired(formData.nom)) return "Le nom est requis";
        if (!validators.validateRequired(formData.prenom)) return "Le prénom est requis";
        if (!validators.validateRequired(formData.email)) return "L'email est requis";
        if (!validators.validateRequired(formData.password)) return "Le mot de passe est requis";
        if (!validators.validateRequired(formData.telephone)) return "Le téléphone est requis";
        if (!validators.validateRequired(formData.sexe)) return "Le sexe est requis";
        if (!validators.validateRequired(formData.date_naissance)) return "La date de naissance est requise";

        // Format validation
        if (!validators.validateUsername(formData.username)) return "Le nom d'utilisateur doit contenir 3-20 caractères (lettres, chiffres, _)";
        if (!validators.validateEmail(formData.email)) return "Format d'email invalide";
        if (!validators.validatePassword(formData.password)) return "Le mot de passe doit contenir au moins 8 caractères";
        if (!validators.validatePhone(formData.telephone)) return "Le téléphone doit commencer par +243 suivi de 9 chiffres (ex: +243999999999)";

        // Password confirmation
        if (formData.password !== formData.confirmPassword) return "Les mots de passe ne correspondent pas";

        // Selection validation
        if (!selectedProvince) return "Veuillez sélectionner une province";
        if (!selectedUserType) return "Veuillez sélectionner un type d'utilisateur";
        if (!selectedUniversite) return "Veuillez sélectionner une université";

        // Student-specific validation
        if (selectedUserType?.value === 'etudiant' && !validators.validateRequired(formData.faculte)) {
            return "La faculté est requise pour les étudiants";
        }

        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const validationError = validateForm();
        if (validationError) {
            showError(validationError);
            return;
        }

        setLoading(true);

        try {
            // Format the date to ISO format with timezone
            const dateFormatted = formData.date_naissance ? 
                new Date(formData.date_naissance + 'T00:00:00+01:00').toISOString() : 
                null;

            const registrationData = {
                username: formData.username.trim(),
                nom: formData.nom.trim(),
                prenom: formData.prenom.trim(),
                password: formData.password,
                role: selectedUserType.value,
                sexe: formData.sexe,
                telephone: formData.telephone.trim(),
                email: formData.email.trim(),
                faculte: selectedUserType.value === 'etudiant' ? formData.faculte.trim() : (formData.faculte || ""),
                universite: selectedUniversite.nom,
                date_naissance: dateFormatted
            };

            const response = await authAPI.register(registrationData);
            // console.log('Registration response:', response);
            // Success - registration completed
            showSuccess('Compte créé avec succès ! Redirection...');

            // If the API returns a token, save the session automatically
            if (response.token) {
                saveSession(response.token, response.user || response.data);

                // Redirect to home page after successful registration
                setTimeout(() => {
                    // console.log('User registered and logged in:', response.user || response.data);
                    navigate('/home');
                }, 2000);
            } else {
                // If no token, redirect to login page
                setTimeout(() => {
                    navigate('/login', {
                        state: {
                            message: 'Compte créé avec succès ! Veuillez vous connecter.'
                        }
                    });
                }, 2000);
            }

        } catch (err) {
            console.error('Registration error:', err);
            showError(err.message || 'Erreur lors de la création du compte');
        } finally {
            setLoading(false);
        }
    };

    const goBackToUniversites = () => {
        navigate('/select-universite', {
            state: {
                selectedProvince,
                selectedUserType
            }
        });
    };

    return (
        <div className="user-types-page">
            {/* Toast Container */}
            <ToastContainer toasts={toasts} onClose={removeToast} />

            {/* Header */}
            <header className="user-types-header">
                <div className="user-types-header-content">
                    <div className="user-types-title-section">
                        <h1 className="user-types-main-title">Créer un Compte</h1>
                        <p className="user-types-subtitle">Complétez vos informations personnelles</p>

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
                            {selectedUserType && (
                                <div className="selected-info">
                                    <span className="info-label">Type:</span>
                                    <span className="info-value">{selectedUserType.name}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="user-types-nav">
                        <button
                            onClick={goToLogin}
                            className="btn btn-outline"
                        >
                            Retour à la connexion
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="user-types-main">
                <div className="user-types-container">
                    <div className="user-types-intro">
                        <p className="user-types-description">
                            Complétez le formulaire ci-dessous pour créer votre compte.
                            Tous les champs marqués d'un astérisque (*) sont obligatoires.
                        </p>
                    </div>

                    {/* Toasts are displayed in ToastContainer at the top of the page */}

                    {/* Check if all selections are made */}
                    {!selectedProvince || !selectedUserType || !selectedUniversite ? (
                        <div className="user-type-card" style={{ textAlign: 'center', padding: '2rem' }}>
                            <div className="user-type-icon">
                                <FaExclamationTriangle />
                            </div>
                            <div className="user-type-content">
                                <h3 className="user-type-name">Informations manquantes</h3>
                                <p className="user-type-description">
                                    Veuillez compléter votre sélection avant de créer votre compte.
                                </p>
                            </div>

                            <div className="completion-steps">
                                {!selectedProvince && (
                                    <button
                                        onClick={() => navigate('/provinces')}
                                        className="btn btn-primary"
                                    >
                                        1. Choisir ma province
                                    </button>
                                )}

                                {selectedProvince && !selectedUserType && (
                                    <button
                                        onClick={() => navigate('/user-types', { state: { selectedProvince } })}
                                        className="btn btn-primary"
                                    >
                                        2. Choisir le type d'utilisateur
                                    </button>
                                )}

                                {selectedProvince && selectedUserType && !selectedUniversite && (
                                    <button
                                        onClick={() => navigate('/select-universite', {
                                            state: { selectedProvince, selectedUserType }
                                        })}
                                        className="btn btn-primary"
                                    >
                                        3. Choisir l'université
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Registration Form */
                        <div className="registration-form-container">
                            <form onSubmit={handleSubmit} className="registration-form">
                                <div className="form-section">
                                    <h3 className="section-title required-section">
                                        <FaIdCard /> Informations de connexion
                                    </h3>

                                    <div className="section-description">
                                        Informations nécessaires pour votre connexion
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label required-field" htmlFor="username">
                                                <FaClipboardList /> Nom d'utilisateur
                                            </label>
                                            <input
                                                type="text"
                                                id="username"
                                                name="username"
                                                value={formData.username}
                                                onChange={handleInputChange}
                                                className="form-input"
                                                disabled={loading}
                                                placeholder="Nom d'utilisateur unique"
                                            />
                                            <div className="input-helper">Ce nom sera visible par les autres utilisateurs</div>
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label required-field" htmlFor="email">
                                                <FaEnvelope /> Email
                                            </label>
                                            <input
                                                type="email"
                                                id="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                className="form-input"
                                                disabled={loading}
                                                placeholder="votre@email.com"
                                            />
                                            <div className="input-helper">Utilisé pour la connexion et les notifications</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="form-section">
                                    <h3 className="section-title required-section">
                                        <FaLock /> Sécurité du compte
                                    </h3>
                                    <div className="section-description">
                                        Créez un mot de passe sécurisé pour protéger votre compte
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label required-field" htmlFor="password">
                                                <FaLock /> Mot de passe
                                            </label>
                                            <input
                                                type="password"
                                                id="password"
                                                name="password"
                                                value={formData.password}
                                                onChange={handleInputChange}
                                                className="form-input"
                                                disabled={loading}
                                                placeholder="Minimum 8 caractères"
                                            />
                                            <div className="input-helper">Le mot de passe doit contenir au moins 8 caractères</div>
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label required-field" htmlFor="confirmPassword">
                                                <FaLock /> Confirmer mot de passe
                                            </label>
                                            <input
                                                type="password"
                                                id="confirmPassword"
                                                name="confirmPassword"
                                                value={formData.confirmPassword}
                                                onChange={handleInputChange}
                                                className="form-input"
                                                disabled={loading}
                                                placeholder="Répétez le mot de passe"
                                            />
                                            <div className="input-helper">Doit être identique au mot de passe</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="form-section">
                                    <h3 className="section-title required-section">
                                        <FaUser /> Informations personnelles
                                    </h3>
                                    <div className="section-description">
                                        Vos informations personnelles pour créer votre profil
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label required-field" htmlFor="nom">
                                                <FaUser /> Nom
                                            </label>
                                            <input
                                                type="text"
                                                id="nom"
                                                name="nom"
                                                value={formData.nom}
                                                onChange={handleInputChange}
                                                className="form-input"
                                                disabled={loading}
                                                placeholder="Nom de famille"
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label required-field" htmlFor="prenom">
                                                <FaUser /> Prénom
                                            </label>
                                            <input
                                                type="text"
                                                id="prenom"
                                                name="prenom"
                                                value={formData.prenom}
                                                onChange={handleInputChange}
                                                className="form-input"
                                                disabled={loading}
                                                placeholder="Prénom"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label required-field" htmlFor="telephone">
                                                <FaPhone /> Téléphone
                                            </label>
                                            <input
                                                type="tel"
                                                id="telephone"
                                                name="telephone"
                                                value={formData.telephone}
                                                onChange={handleInputChange}
                                                className="form-input"
                                                disabled={loading}
                                                placeholder="+243999999999"
                                            />
                                            <div className="input-helper">Obligatoirement commencer par +243 suivi de 9 chiffres</div>
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label required-field" htmlFor="sexe">
                                                <FaVenusMars /> Sexe
                                            </label>
                                            <select
                                                id="sexe"
                                                name="sexe"
                                                value={formData.sexe}
                                                onChange={handleInputChange}
                                                className="form-input"
                                                disabled={loading}
                                            >
                                                <option value="">Sélectionner</option>
                                                <option value="masculin">Masculin</option>
                                                <option value="feminin">Féminin</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label required-field" htmlFor="date_naissance">
                                                <FaCalendarAlt /> Date de naissance
                                            </label>
                                            <input
                                                type="date"
                                                id="date_naissance"
                                                name="date_naissance"
                                                value={formData.date_naissance}
                                                onChange={handleInputChange}
                                                className="form-input"
                                                disabled={loading}
                                            />
                                        </div>

                                        {selectedUserType?.value === 'etudiant' && (
                                            <div className="form-group">
                                                <label className="form-label required-field" htmlFor="faculte" >
                                                    <FaGraduationCap /> Faculté (Étudiant)
                                                </label>
                                                <input
                                                    type="text"
                                                    id="faculte"
                                                    name="faculte"
                                                    value={formData.faculte}
                                                    onChange={handleInputChange}
                                                    className="form-input"

                                                    disabled={loading}
                                                    placeholder="Ex: Sciences, Médecine, Droit..."
                                                />
                                                <div className="input-helper">
                                                    Champ spécial pour les étudiants
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/user-types', {
                                            state: { selectedProvince, selectedUniversite }
                                        })}
                                        className="btn btn-outline"
                                        disabled={loading}
                                    >
                                        Modifier la sélection
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="btn btn-primary"
                                    >
                                        {loading ? 'Création du compte...' : 'Créer mon compte'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default Inscription