import React, { useState } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import {
    FaExclamationTriangle,
    FaUser,
    FaEnvelope,
    FaLock,
    FaPhone,
    FaCalendarAlt,
    FaGraduationCap,
    FaAt,
    FaIdCard,
    FaEye,
    FaEyeSlash,
    FaSyncAlt,
    FaCheck
} from 'react-icons/fa';
import { authAPI, validators } from '../api';
import { saveSession } from '../utils/auth';
import { buildUsername, randomUsernameSuffix } from '../utils/username';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ToastContainer';
import RegistrationLayout from '../components/registration/RegistrationLayout';

function Inscription() {
    const navigate = useNavigate();
    const location = useLocation();
    const selectedProvince = location.state?.selectedProvince;
    const selectedUserType = location.state?.selectedUserType;
    const selectedUniversite = location.state?.selectedUniversite;

    const [formData, setFormData] = useState({
        nom: '',
        prenom: '',
        password: '',
        confirmPassword: '',
        email: '',
        telephone: '+243',
        sexe: '',
        date_naissance: '',
        faculte: ''
    });

    const [usernameSuffix, setUsernameSuffix] = useState(randomUsernameSuffix);
    const username = buildUsername(formData.nom, formData.prenom, usernameSuffix);
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { toasts, removeToast, showError, showSuccess } = useToast();

    const goToLogin = () => {
        navigate('/login');
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const validateForm = () => {
        // Required fields validation
        if (!validators.validateRequired(formData.nom)) return "Le nom est requis";
        if (!validators.validateRequired(formData.prenom)) return "Le prénom est requis";
        if (!validators.validateRequired(formData.email)) return "L'email est requis";
        if (!validators.validateRequired(formData.password)) return "Le mot de passe est requis";
        if (!validators.validateRequired(formData.telephone)) return "Le téléphone est requis";
        if (!validators.validateRequired(formData.sexe)) return "Le sexe est requis";
        if (!validators.validateRequired(formData.date_naissance)) return "La date de naissance est requise";

        // Format validation
        if (!validators.validateUsername(username)) return "Le nom doit contenir des lettres pour générer le nom d'utilisateur";
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

        setSubmitted(true);
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
                username,
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

    const goBackToUserTypes = () => {
        navigate('/user-types', { state: { selectedProvince, selectedUniversite } });
    };

    // Erreurs par champ, affichées sous les champs après une première tentative d'envoi.
    const fieldErrors = submitted ? {
        nom: !validators.validateRequired(formData.nom) ? 'Le nom est requis'
            : !validators.validateUsername(username) ? "Le nom doit contenir des lettres" : null,
        prenom: !validators.validateRequired(formData.prenom) ? 'Le prénom est requis' : null,
        telephone: !validators.validateRequired(formData.telephone) || formData.telephone.trim() === '+243' ? 'Le téléphone est requis'
            : !validators.validatePhone(formData.telephone) ? '+243 suivi de 9 chiffres (ex : +243999999999)' : null,
        sexe: !validators.validateRequired(formData.sexe) ? 'Le sexe est requis' : null,
        date_naissance: !validators.validateRequired(formData.date_naissance) ? 'La date de naissance est requise' : null,
        faculte: selectedUserType?.value === 'etudiant' && !validators.validateRequired(formData.faculte)
            ? 'La faculté est requise pour les étudiants' : null,
        email: !validators.validateRequired(formData.email) ? "L'email est requis"
            : !validators.validateEmail(formData.email) ? "Format d'email invalide" : null,
        password: !validators.validateRequired(formData.password) ? 'Le mot de passe est requis'
            : !validators.validatePassword(formData.password) ? 'Au moins 8 caractères' : null,
        confirmPassword: formData.password !== formData.confirmPassword ? 'Les mots de passe ne correspondent pas' : null
    } : {};

    const inputProps = (name) => ({
        id: name,
        name,
        value: formData[name],
        onChange: handleInputChange,
        disabled: loading,
        className: `reg-input ${fieldErrors[name] ? 'invalid' : ''}`,
        'aria-invalid': Boolean(fieldErrors[name]),
        'aria-describedby': `${name}-help`
    });

    const Help = ({ name, children }) => (
        <p id={`${name}-help`} className={`reg-help ${fieldErrors[name] ? 'error' : ''}`}>
            {fieldErrors[name] || children}
        </p>
    );

    const passwordChecks = [
        { ok: formData.password.length >= 8, label: '8 caractères minimum' },
        { ok: Boolean(formData.password) && formData.password === formData.confirmPassword, label: 'Mots de passe identiques' }
    ];

    const summary = [
        selectedProvince && { label: 'Province', value: selectedProvince.nom, onEdit: () => navigate('/provinces') },
        selectedUniversite && { label: 'Établissement', value: selectedUniversite.nom, onEdit: goBackToUniversites },
        selectedUserType && { label: 'Profil', value: selectedUserType.name, onEdit: goBackToUserTypes }
    ].filter(Boolean);

    const missingSelection = !selectedProvince || !selectedUserType || !selectedUniversite;
    const today = new Date().toISOString().split('T')[0];

    return (
        <RegistrationLayout
            step={4}
            title="Créez votre compte"
            subtitle="Dernière étape : renseignez vos informations. Les champs marqués d'un astérisque (*) sont obligatoires."
            summary={summary}
            back={{ label: 'Retour à la connexion', onClick: goToLogin }}
        >
            <ToastContainer toasts={toasts} onClose={removeToast} />

            {missingSelection ? (
                <div className="reg-empty">
                    <FaExclamationTriangle className="reg-empty-icon" aria-hidden="true" />
                    <h2>Informations manquantes</h2>
                    <p>Veuillez compléter votre sélection avant de créer votre compte.</p>
                    <div className="reg-empty-actions">
                        {!selectedProvince && (
                            <button type="button" className="reg-btn reg-btn-primary" onClick={() => navigate('/provinces')}>
                                1. Choisir ma province
                            </button>
                        )}
                        {selectedProvince && !selectedUniversite && (
                            <button type="button" className="reg-btn reg-btn-primary" onClick={goBackToUniversites}>
                                2. Choisir mon établissement
                            </button>
                        )}
                        {selectedProvince && selectedUniversite && !selectedUserType && (
                            <button type="button" className="reg-btn reg-btn-primary" onClick={goBackToUserTypes}>
                                3. Choisir mon profil
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="reg-form" noValidate>
                    <section className="reg-card">
                        <h2 className="reg-card-title"><span className="reg-card-icon"><FaUser aria-hidden="true" /></span> Informations personnelles</h2>
                        <div className="reg-fields">
                            <div className="reg-field">
                                <label htmlFor="nom">Nom *</label>
                                <input type="text" autoComplete="family-name" placeholder="Nom de famille" {...inputProps('nom')} />
                                <Help name="nom" />
                            </div>
                            <div className="reg-field">
                                <label htmlFor="prenom">Prénom *</label>
                                <input type="text" autoComplete="given-name" placeholder="Prénom" {...inputProps('prenom')} />
                                <Help name="prenom" />
                            </div>
                            <div className="reg-field">
                                <label htmlFor="telephone">Téléphone *</label>
                                <div className="reg-input-icon">
                                    <FaPhone aria-hidden="true" />
                                    <input type="tel" autoComplete="tel" placeholder="+243999999999" {...inputProps('telephone')} />
                                </div>
                                <Help name="telephone">+243 suivi de 9 chiffres</Help>
                            </div>
                            <div className="reg-field">
                                <span className="reg-label" id="sexe-label">Sexe *</span>
                                <div className="reg-segmented" role="radiogroup" aria-labelledby="sexe-label">
                                    {[['masculin', 'Masculin'], ['feminin', 'Féminin']].map(([value, label]) => (
                                        <label key={value} className={`reg-segment ${formData.sexe === value ? 'active' : ''} ${fieldErrors.sexe ? 'invalid' : ''}`}>
                                            <input type="radio" name="sexe" value={value} checked={formData.sexe === value} onChange={handleInputChange} disabled={loading} />
                                            {label}
                                        </label>
                                    ))}
                                </div>
                                <Help name="sexe" />
                            </div>
                            <div className="reg-field">
                                <label htmlFor="date_naissance">Date de naissance *</label>
                                <div className="reg-input-icon">
                                    <FaCalendarAlt aria-hidden="true" />
                                    <input type="date" max={today} {...inputProps('date_naissance')} />
                                </div>
                                <Help name="date_naissance" />
                            </div>
                            {selectedUserType?.value === 'etudiant' && (
                                <div className="reg-field">
                                    <label htmlFor="faculte">Faculté *</label>
                                    <div className="reg-input-icon">
                                        <FaGraduationCap aria-hidden="true" />
                                        <input type="text" placeholder="Ex. : Sciences, Médecine, Droit…" {...inputProps('faculte')} />
                                    </div>
                                    <Help name="faculte">Requise pour les étudiants</Help>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="reg-card">
                        <h2 className="reg-card-title"><span className="reg-card-icon"><FaIdCard aria-hidden="true" /></span> Informations de connexion</h2>
                        <div className="reg-fields">
                            <div className="reg-field">
                                <label htmlFor="username">Nom d'utilisateur</label>
                                <div className="username-generated">
                                    <div className="reg-input-icon">
                                        <FaAt aria-hidden="true" />
                                        <input
                                            type="text"
                                            id="username"
                                            value={username}
                                            className="reg-input reg-input-readonly"
                                            readOnly
                                            placeholder="Généré à partir du nom et du prénom"
                                            aria-describedby="username-help"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="username-generated-refresh"
                                        onClick={() => setUsernameSuffix(randomUsernameSuffix())}
                                        disabled={loading || !username}
                                        title="Générer d'autres chiffres"
                                        aria-label="Générer d'autres chiffres pour le nom d'utilisateur"
                                    >
                                        <FaSyncAlt aria-hidden="true" />
                                    </button>
                                </div>
                                <p className="reg-help" id="username-help">Créé automatiquement : nom + 2 lettres du prénom + 2 chiffres</p>
                            </div>
                            <div className="reg-field">
                                <label htmlFor="email">Email *</label>
                                <div className="reg-input-icon">
                                    <FaEnvelope aria-hidden="true" />
                                    <input type="email" autoComplete="email" placeholder="votre@email.com" {...inputProps('email')} />
                                </div>
                                <Help name="email">Utilisé pour la connexion et les notifications</Help>
                            </div>
                        </div>
                    </section>

                    <section className="reg-card">
                        <h2 className="reg-card-title"><span className="reg-card-icon"><FaLock aria-hidden="true" /></span> Sécurité du compte</h2>
                        <div className="reg-fields">
                            <div className="reg-field">
                                <label htmlFor="password">Mot de passe *</label>
                                <div className="reg-input-icon">
                                    <FaLock aria-hidden="true" />
                                    <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Minimum 8 caractères" {...inputProps('password')} />
                                    <button type="button" className="reg-input-action" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                                        {showPassword ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
                                    </button>
                                </div>
                                <Help name="password" />
                            </div>
                            <div className="reg-field">
                                <label htmlFor="confirmPassword">Confirmer le mot de passe *</label>
                                <div className="reg-input-icon">
                                    <FaLock aria-hidden="true" />
                                    <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Répétez le mot de passe" {...inputProps('confirmPassword')} />
                                </div>
                                <Help name="confirmPassword" />
                            </div>
                        </div>
                        <ul className="reg-checks">
                            {passwordChecks.map((check) => (
                                <li key={check.label} className={check.ok ? 'ok' : ''}>
                                    <FaCheck aria-hidden="true" /> {check.label}
                                </li>
                            ))}
                        </ul>
                    </section>

                    <div className="reg-form-actions">
                        <button type="button" onClick={goBackToUserTypes} className="reg-btn reg-btn-outline" disabled={loading}>
                            Modifier la sélection
                        </button>
                        <button type="submit" disabled={loading} className="reg-btn reg-btn-primary reg-btn-lg">
                            {loading ? 'Création du compte…' : 'Créer mon compte'}
                        </button>
                    </div>
                </form>
            )}
        </RegistrationLayout>
    );
}

export default Inscription;
