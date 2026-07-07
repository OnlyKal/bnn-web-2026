import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FaUser, 
    FaEnvelope, 
    FaPhone, 
    FaIdCard, 
    FaUniversity, 
    FaMapMarkerAlt, 
    FaCalendar,
    FaVenusMars,
    FaUserTie,
    FaEdit,
    FaSave,
    FaTimes,
    FaHeart,
    FaCamera,
    FaUpload,
    FaKey,
    FaLock
} from 'react-icons/fa';
import {
    LuArrowRight,
    LuChartBar,
    LuBookOpen,
    LuCalendar,
    LuCamera,
    LuGraduationCap,
    LuHistory,
    LuHeart,
    LuIdCard,
    LuKeyRound,
    LuLogOut,
    LuMail,
    LuMapPin,
    LuMessageCircle,
    LuPhone,
    LuSettings,
    LuShieldCheck,
    LuSparkles,
    LuUser,
    LuVenetianMask
} from 'react-icons/lu';
import { getCurrentUser, logout, isAuthenticated, saveSession } from './utils/auth';
import { userAPI, fileUtils, validators, favorisAPI } from './api';
import { getMediaUrl } from './config';
import { useToast } from './hooks/useToast';
import { ToastContainer } from './components/ToastContainer';
import AppNavigation from './components/AppNavigation';
import { addLocalHistoryItem } from './utils/localHistory';

const normalizeUserPayload = (payload) => {
    if (!payload) return null;
    return payload.data || payload.user || payload.profile || payload;
};

const getRoleLabel = (user) => {
    const role = user?.role || user?.type_utilisateur || user?.typeUtilisateur || user?.profil;

    if (role && typeof role === 'object') {
        return role.nom || role.name || role.libelle || role.label || role.code || 'Non renseigné';
    }

    const roleLabels = {
        chercheur: 'Chercheur',
        etudiant: 'Etudiant',
        professeur: 'Professeur',
        autres: 'Autres',
        admin: 'Administrateur',
        administrateur: 'Administrateur'
    };

    return roleLabels[String(role || '').toLowerCase()] || role || 'Non renseigné';
};

const isAdministrator = (user) => {
    const role = user?.role || user?.type_utilisateur || user?.typeUtilisateur || user?.profil;
    const roleValue = role && typeof role === 'object'
        ? role.nom || role.name || role.libelle || role.label || role.code
        : role;

    return ['administrateur', 'admin'].includes(String(roleValue || '').toLowerCase());
};

function Profile() {
    const [user, setUser] = useState(null);
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toasts, removeToast, showError, showSuccess } = useToast();
    const [formData, setFormData] = useState({});
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [previewAvatar, setPreviewAvatar] = useState(null);
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [favoritesCount, setFavoritesCount] = useState(0);
    const [passwordData, setPasswordData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const navigate = useNavigate();

    useEffect(() => {
        // Check if user is authenticated
        if (!isAuthenticated()) {
            navigate('/login');
            return;
        }

        const currentUser = getCurrentUser();
        setUser(currentUser);
        setFormData({
            nom: currentUser.nom || '',
            prenom: currentUser.prenom || '',
            telephone: currentUser.telephone || '',
            email: currentUser.email || '',
            role: currentUser.role || 'chercheur',
        });

        const refreshProfile = async () => {
            try {
                const response = await userAPI.getProfile();
                const freshUser = normalizeUserPayload(response);
                const token = localStorage.getItem('authToken');

                if (freshUser && token) {
                    saveSession(token, freshUser);
                    setUser(freshUser);
                    setFormData({
                        nom: freshUser.nom || '',
                        prenom: freshUser.prenom || '',
                        telephone: freshUser.telephone || '',
                        email: freshUser.email || '',
                        role: freshUser.role || 'chercheur',
                    });
                }
            } catch (error) {
                console.warn('Impossible de rafraîchir le profil:', error.message);
            }
        };

        refreshProfile();
    }, [navigate]);

    useEffect(() => {
        const fetchFavoritesCount = async () => {
            try {
                const response = await favorisAPI.getFavoris();
                const favorisData = response?.results?.data || response?.results || response?.data || response;
                setFavoritesCount(Array.isArray(favorisData) ? favorisData.length : response?.count || 0);
            } catch (error) {
                console.warn('Erreur lors du chargement des statistiques favoris:', error.message);
                setFavoritesCount(0);
            }
        };

        if (user) {
            fetchFavoritesCount();
        }
    }, [user]);

    // Cleanup preview URL on unmount
    useEffect(() => {
        return () => {
            if (previewAvatar) {
                URL.revokeObjectURL(previewAvatar);
            }
        };
    }, [previewAvatar]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const goToHome = () => {
        navigate('/home');
    };

    const formatProfileDate = (dateValue) => {
        if (!dateValue) return 'Non renseignée';
        return new Date(dateValue).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        let previewUrl = null;

        try {
            // Validate the file
            fileUtils.validateImageFile(file);

            // Create preview
            previewUrl = URL.createObjectURL(file);
            setPreviewAvatar(previewUrl);

            // Upload avatar
            setAvatarUploading(true);

            // Convert to Base64
            // console.log('Converting file to Base64...');
            const base64 = await fileUtils.fileToBase64(file);
            // console.log('Base64 conversion complete, length:', base64.length);

            // Send to API
            // console.log('Sending avatar update request...');
            const response = await userAPI.updateAvatar({ avatar: base64 });
            // console.log('Avatar update response:', response);

            // Update user data
            const updatedUser = { ...user, avatar: response.avatar };
            const token = localStorage.getItem('authToken');
            saveSession(token, updatedUser);
            setUser(updatedUser);

            // Dispatch custom event to notify other components
            window.dispatchEvent(new CustomEvent('userAvatarUpdated', { 
                detail: { avatar: response.avatar } 
            }));

            // Clean up preview
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
            setPreviewAvatar(null);
            showSuccess('Avatar mis à jour avec succès !');

        } catch (err) {
            console.error('Avatar upload error:', err);
            showError(err.message || 'Erreur lors de la mise à jour de l\'avatar');
            
            // Clean up preview on error
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
            setPreviewAvatar(null);
        } finally {
            setAvatarUploading(false);
            // Clear the file input
            e.target.value = '';
        }
    };

    const triggerAvatarUpload = () => {
        const fileInput = document.getElementById('avatar-upload');
        if (fileInput) {
            fileInput.click();
        }
    };

    const handlePasswordInputChange = (e) => {
        const { name, value } = e.target;
        setPasswordData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setPasswordLoading(true);

        try {
            // Validate password data
            const validation = validators.validatePasswordChange(
                passwordData.oldPassword,
                passwordData.newPassword,
                passwordData.confirmPassword
            );

            if (!validation.isValid) {
                throw new Error(validation.errors.join('\n'));
            }

            // Send to API
            // console.log('Sending password change request...');
            await userAPI.changePassword({
                old_password: passwordData.oldPassword,
                new_password: passwordData.newPassword
            });

            showSuccess('Mot de passe mis à jour avec succès !');
            
            // Reset form and close modal
            setPasswordData({
                oldPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
            setChangingPassword(false);

        } catch (err) {
            console.error('Password change error:', err);
            showError(err.message || 'Erreur lors du changement de mot de passe');
        } finally {
            setPasswordLoading(false);
        }
    };

    const cancelPasswordChange = () => {
        setPasswordData({
            oldPassword: '',
            newPassword: '',
            confirmPassword: ''
        });
        setChangingPassword(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Call the real API to update profile
            // console.log('Updating profile with:', formData);
            const response = await userAPI.updateProfile(formData);
            // console.log('Profile update response:', response);
            
            // Update local user data with the response
            const updatedUser = response.data;
            const token = localStorage.getItem('authToken');
            
            saveSession(token, updatedUser);
            setUser(updatedUser);
            
            // Dispatch custom event to notify other components
            window.dispatchEvent(new CustomEvent('userProfileUpdated', { 
                detail: { user: updatedUser } 
            }));
            
            showSuccess(response.message || 'Profil mis à jour avec succès !');
            setEditing(false);
        } catch (err) {
            console.error('Profile update error:', err);
            showError(err.message || 'Erreur lors de la mise à jour du profil');
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="profile-page">
                <AppNavigation />
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p className="loading-text">Chargement...</p>
                </div>
            </div>
        );
    }

    const displayName = 'Bihango Justin';
    const username = '@tony';
    const roleLabel = getRoleLabel(user);
    const canAccessStatsReport = isAdministrator(user);
    const initial = displayName[0];
    const joinDate = formatProfileDate(user.date_inscription || user.date_joined || user.created_at);
    const fullName = user.prenom && user.nom ? `${user.prenom} ${user.nom}` : displayName;
    const avatarAlt = `Avatar de ${displayName}`;
    const avatarSrc = previewAvatar || (user.avatar ? getMediaUrl(user.avatar) : null);

    const personalInfoItems = [
        { icon: LuUser, label: 'Nom complet', value: fullName || displayName },
        { icon: LuMail, label: 'Email', value: user.email || 'Non renseigné' },
        { icon: LuPhone, label: 'Téléphone', value: user.telephone || 'Non renseigné' },
        { icon: LuVenetianMask, label: 'Sexe', value: user.sexe || 'Non renseigné' },
        { icon: LuMapPin, label: 'Province', value: user.province || 'Non renseignée' },
        { icon: LuIdCard, label: 'Matricule', value: user.matricule || 'Non renseigné' },
        { icon: LuGraduationCap, label: 'Université', value: user.universite || 'Non renseignée' },
        { icon: LuBookOpen, label: 'Faculté', value: user.faculte || 'Non renseignée' },
        { icon: LuShieldCheck, label: 'Rôle', value: roleLabel },
        { icon: LuCalendar, label: "Date d'inscription", value: joinDate }
    ];

    const stats = [
        { icon: LuHeart, value: favoritesCount, label: 'Favoris' },
        { icon: LuBookOpen, value: 0, label: 'Ressources consultées' },
        { icon: LuMessageCircle, value: 0, label: 'Messages envoyés' },
        { icon: LuCalendar, value: '—', label: 'Dernière connexion' },
        { icon: LuGraduationCap, value: 0, label: 'Cours suivis' }
    ];

    const quickActions = [
        {
            icon: LuHeart,
            title: 'Mes Favoris',
            description: 'Retrouver vos ressources enregistrées',
            onClick: () => {
                addLocalHistoryItem({
                    type: 'action',
                    title: 'Action rapide: Mes Favoris',
                    description: 'Ouverture des favoris depuis le profil',
                    url: '/favoris',
                    icon: 'favorite'
                });
                navigate('/favoris');
            }
        },
        {
            icon: LuKeyRound,
            title: 'Modifier le mot de passe',
            description: 'Renforcer la sécurité du compte',
            onClick: () => {
                addLocalHistoryItem({
                    type: 'action',
                    title: 'Action rapide: Mot de passe',
                    description: 'Ouverture du formulaire de sécurité',
                    url: '/profile',
                    icon: 'action'
                });
                setChangingPassword(true);
            }
        },
        {
            icon: LuBookOpen,
            title: 'Mes Ressources',
            description: 'Parcourir la bibliothèque disponible',
            onClick: () => {
                addLocalHistoryItem({
                    type: 'action',
                    title: 'Action rapide: Mes Ressources',
                    description: 'Retour vers la bibliothèque',
                    url: '/home',
                    icon: 'resource'
                });
                goToHome();
            }
        },
        {
            icon: LuSettings,
            title: 'Paramètres',
            description: 'Ajuster vos préférences personnelles',
            onClick: () => {
                addLocalHistoryItem({
                    type: 'action',
                    title: 'Action rapide: Paramètres',
                    description: 'Edition du profil utilisateur',
                    url: '/profile',
                    icon: 'action'
                });
                setEditing(true);
            }
        },
        {
            icon: LuHistory,
            title: 'Historique',
            description: 'Revoir vos dernières activités locales',
            onClick: () => {
                addLocalHistoryItem({
                    type: 'action',
                    title: 'Action rapide: Historique',
                    description: 'Ouverture de l’historique local',
                    url: '/historique',
                    icon: 'action'
                });
                navigate('/historique');
            }
        },
        canAccessStatsReport && {
            icon: LuChartBar,
            title: 'Rapports statistiques',
            description: 'Analyser les ajouts et modifications',
            onClick: () => {
                addLocalHistoryItem({
                    type: 'action',
                    title: 'Action rapide: Rapports statistiques',
                    description: 'Ouverture du rapport des ajouts et modifications',
                    url: '/profile/statistiques',
                    icon: 'action'
                });
                navigate('/profile/statistiques');
            }
        },
        {
            icon: LuLogOut,
            title: 'Déconnexion',
            description: 'Quitter votre session en toute sécurité',
            onClick: () => {
                addLocalHistoryItem({
                    type: 'action',
                    title: 'Déconnexion',
                    description: 'Session fermée depuis le profil',
                    url: '/login',
                    icon: 'action'
                });
                handleLogout();
            },
            danger: true
        }
    ].filter(Boolean);

    const roleOptions = [
        { value: 'chercheur', label: 'Chercheur' },
        { value: 'etudiant', label: 'Etudiant' },
        { value: 'professeur', label: 'Professeur' },
        { value: 'autres', label: 'Autres' }
    ];

    const handleRoleToggle = (role) => {
        setFormData(prev => ({
            ...prev,
            role
        }));
    };

    return (
        <div className="profile-page">
            <AppNavigation />

            {/* Main Content */}
            <div className="profile-main">
                <ToastContainer toasts={toasts} onClose={removeToast} />
                <div className="profile-container">
                    {avatarUploading && (
                        <div className="profile-notification info">
                            <span className="profile-notification-icon">📤</span>
                            <span>Mise à jour de l'avatar en cours...</span>
                        </div>
                    )}

                    <div className="profile-premium-layout">
                        <section className="profile-premium-hero" aria-labelledby="profile-name">
                            <div className="profile-premium-avatar-wrap">
                                <input
                                    id="avatar-upload"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleAvatarChange}
                                    style={{ display: 'none' }}
                                />
                                <button
                                    type="button"
                                    className="profile-premium-avatar"
                                    onClick={triggerAvatarUpload}
                                    disabled={avatarUploading}
                                    aria-label="Modifier la photo de profil"
                                >
                                    {avatarSrc ? (
                                        <img
                                            src={avatarSrc}
                                            alt={avatarAlt}
                                            onError={(event) => {
                                                event.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <span>{initial}</span>
                                    )}
                                    <span className="profile-premium-camera">
                                        {avatarUploading ? <span className="avatar-loading-spinner" /> : <LuCamera />}
                                    </span>
                                </button>
                            </div>

                            <div className="profile-premium-identity">
                                <div className="profile-premium-kicker">
                                    <LuSparkles />
                                    Profil utilisateur
                                </div>
                                <h1 id="profile-name">{displayName}</h1>
                                <p>{username}</p>
                                <div className="profile-premium-badges">
                                    <span className="profile-premium-badge">{roleLabel}</span>
                                    <span className="profile-premium-badge online">En ligne</span>
                                </div>
                                <div className="profile-premium-meta">
                                    <span><LuGraduationCap /> {user.faculte || user.universite || 'Université non renseignée'}</span>
                                    <span><LuCalendar /> Inscrit le {joinDate}</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                className="profile-premium-edit"
                                onClick={() => setEditing(true)}
                            >
                                <FaEdit />
                                Modifier le profil
                            </button>
                        </section>

                        {editing && (
                            <section className="profile-premium-card profile-premium-edit-card">
                                <div className="profile-premium-section-heading">
                                    <div>
                                        <span>Edition</span>
                                        <h2>Modifier le profil</h2>
                                    </div>
                                </div>
                                <form onSubmit={handleSubmit} className="profile-edit-form">
                                    <div className="profile-form-grid">
                                        <div className="profile-form-group">
                                            <label className="profile-form-label"><FaUser className="profile-form-icon" /> Nom</label>
                                            <input type="text" name="nom" value={formData.nom} onChange={handleInputChange} className="profile-form-input" disabled={loading} />
                                        </div>
                                        <div className="profile-form-group">
                                            <label className="profile-form-label"><FaUser className="profile-form-icon" /> Prénom</label>
                                            <input type="text" name="prenom" value={formData.prenom} onChange={handleInputChange} className="profile-form-input" disabled={loading} />
                                        </div>
                                        <div className="profile-form-group">
                                            <label className="profile-form-label"><FaPhone className="profile-form-icon" /> Téléphone</label>
                                            <input type="tel" name="telephone" value={formData.telephone} onChange={handleInputChange} className="profile-form-input" disabled={loading} />
                                        </div>
                                        <div className="profile-form-group">
                                            <label className="profile-form-label"><FaEnvelope className="profile-form-icon" /> Email</label>
                                            <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="profile-form-input" disabled={loading} />
                                        </div>
                                        <div className="profile-form-group">
                                            <label className="profile-form-label"><FaUserTie className="profile-form-icon" /> Rôle</label>
                                            <div className="profile-role-toggle" role="radiogroup" aria-label="Rôle">
                                                {roleOptions.map((role) => (
                                                    <button
                                                        key={role.value}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={formData.role === role.value}
                                                        className={`profile-role-toggle-btn ${formData.role === role.value ? 'active' : ''}`}
                                                        onClick={() => handleRoleToggle(role.value)}
                                                        disabled={loading}
                                                    >
                                                        {role.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="profile-form-actions">
                                        <button type="submit" disabled={loading} className="profile-btn primary">
                                            <FaSave />
                                            {loading ? 'Enregistrement...' : 'Enregistrer'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditing(false);
                                                setFormData({
                                                    nom: user.nom || '',
                                                    prenom: user.prenom || '',
                                                    telephone: user.telephone || '',
                                                    email: user.email || '',
                                                    role: user.role || 'chercheur',
                                                });
                                            }}
                                            disabled={loading}
                                            className="profile-btn secondary"
                                        >
                                            <FaTimes />
                                            Annuler
                                        </button>
                                    </div>
                                </form>
                            </section>
                        )}

                        <div className="profile-premium-columns">
                            <section className="profile-premium-card profile-premium-info">
                                <div className="profile-premium-section-heading">
                                    <div>
                                        <span>Compte</span>
                                        <h2>Informations personnelles</h2>
                                    </div>
                                </div>
                                <div className="profile-premium-info-grid">
                                    {personalInfoItems.map((item) => {
                                        const Icon = item.icon;
                                        return (
                                            <div className="profile-premium-info-item" key={item.label}>
                                                <span className="profile-premium-info-icon"><Icon /></span>
                                                <span className="profile-premium-info-label">{item.label}</span>
                                                <strong>{item.value}</strong>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            <section className="profile-premium-card profile-premium-stats-card">
                                <div className="profile-premium-section-heading">
                                    <div>
                                        <span>Activité</span>
                                        <h2>Statistiques</h2>
                                    </div>
                                </div>
                                <div className="profile-premium-stats">
                                    {stats.map((stat, index) => {
                                        const Icon = stat.icon;
                                        return (
                                            <div className="profile-premium-stat" key={stat.label} style={{ animationDelay: `${index * 55}ms` }}>
                                                <Icon />
                                                <strong>{stat.value}</strong>
                                                <span>{stat.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>

                        <section className="profile-premium-card">
                            <div className="profile-premium-section-heading">
                                <div>
                                    <span>Raccourcis</span>
                                    <h2>Actions rapides</h2>
                                </div>
                            </div>
                            <div className="profile-premium-actions">
                                {quickActions.map((action) => {
                                    const Icon = action.icon;
                                    return (
                                        <button
                                            type="button"
                                            key={action.title}
                                            className={`profile-premium-action ${action.danger ? 'danger' : ''}`}
                                            onClick={action.onClick}
                                        >
                                            <span className="profile-premium-action-icon"><Icon /></span>
                                            <span>
                                                <strong>{action.title}</strong>
                                                <small>{action.description}</small>
                                            </span>
                                            <LuArrowRight className="profile-premium-action-arrow" />
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    </div>

                    <div className="profile-grid">
                        {/* Avatar et informations principales */}
                        <div className="profile-card main-info">
                            <div className="profile-card-header">
                                <h3 className="profile-card-title">
                                    Informations principales
                                </h3>
                                {!editing && (
                                    <button
                                        onClick={() => setEditing(true)}
                                        className="profile-edit-btn"
                                    >
                                        <FaEdit />
                                        Modifier
                                    </button>
                                )}
                            </div>

                            <div className="profile-avatar-section">
                                <div className="profile-avatar-container">
                                    {/* Hidden file input */}
                                    <input
                                        id="avatar-upload"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAvatarChange}
                                        style={{ display: 'none' }}
                                    />
                                    
                                    {/* Avatar display */}
                                    <div className="profile-avatar-wrapper">
                                        {previewAvatar ? (
                                            <img 
                                                src={previewAvatar}
                                                alt="Aperçu de l'avatar"
                                                className="profile-avatar"
                                            />
                                        ) : user.avatar ? (
                                            <img 
                                                src={getMediaUrl(user.avatar)}
                                                alt={`Avatar de ${user.prenom || user.username}`}
                                                className="profile-avatar"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        <div 
                                            className="profile-avatar-placeholder"
                                            style={{display: (user.avatar || previewAvatar) ? 'none' : 'flex'}}
                                        >
                                            {(user.prenom?.[0] || user.nom?.[0] || user.username?.[0] || 'U').toUpperCase()}
                                        </div>
                                        
                                        {/* Avatar upload overlay */}
                                        <div className="profile-avatar-overlay">
                                            <button
                                                type="button"
                                                onClick={triggerAvatarUpload}
                                                disabled={avatarUploading}
                                                className="profile-avatar-upload-btn"
                                                title="Modifier l'avatar"
                                            >
                                                {avatarUploading ? (
                                                    <div className="avatar-loading-spinner"></div>
                                                ) : (
                                                    <FaCamera />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="profile-user-name">
                                    <h2>{user.prenom && user.nom ? `${user.prenom} ${user.nom}` : user.username}</h2>
                                    <p className="profile-user-role">{user.role} • {user.faculte}</p>
                                </div>
                            </div>

                            {editing ? (
                                <form onSubmit={handleSubmit} className="profile-edit-form">
                                    <div className="profile-form-grid">
                                        <div className="profile-form-group">
                                            <label className="profile-form-label">
                                                <FaUser className="profile-form-icon" />
                                                Nom
                                            </label>
                                            <input
                                                type="text"
                                                name="nom"
                                                value={formData.nom}
                                                onChange={handleInputChange}
                                                className="profile-form-input"
                                                disabled={loading}
                                            />
                                        </div>

                                        <div className="profile-form-group">
                                            <label className="profile-form-label">
                                                <FaUser className="profile-form-icon" />
                                                Prénom
                                            </label>
                                            <input
                                                type="text"
                                                name="prenom"
                                                value={formData.prenom}
                                                onChange={handleInputChange}
                                                className="profile-form-input"
                                                disabled={loading}
                                            />
                                        </div>

                                        <div className="profile-form-group">
                                            <label className="profile-form-label">
                                                <FaPhone className="profile-form-icon" />
                                                Téléphone
                                            </label>
                                            <input
                                                type="tel"
                                                name="telephone"
                                                value={formData.telephone}
                                                onChange={handleInputChange}
                                                className="profile-form-input"
                                                disabled={loading}
                                            />
                                        </div>

                                        <div className="profile-form-group">
                                            <label className="profile-form-label">
                                                <FaEnvelope className="profile-form-icon" />
                                                Email
                                            </label>
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                className="profile-form-input"
                                                disabled={loading}
                                            />
                                        </div>

                                        <div className="profile-form-group">
                                            <label className="profile-form-label">
                                                <FaUserTie className="profile-form-icon" />
                                                Rôle
                                            </label>
                                            <div className="profile-role-toggle" role="radiogroup" aria-label="Rôle">
                                                {roleOptions.map((role) => (
                                                    <button
                                                        key={role.value}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={formData.role === role.value}
                                                        className={`profile-role-toggle-btn ${formData.role === role.value ? 'active' : ''}`}
                                                        onClick={() => handleRoleToggle(role.value)}
                                                        disabled={loading}
                                                    >
                                                        {role.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="profile-form-actions">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="profile-btn primary"
                                        >
                                            <FaSave />
                                            {loading ? 'Enregistrement...' : 'Enregistrer'}
                                        </button>
                                        
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditing(false);
                                                setFormData({
                                                    nom: user.nom || '',
                                                    prenom: user.prenom || '',
                                                    telephone: user.telephone || '',
                                                    email: user.email || '',
                                                    role: user.role || 'chercheur',
                                                });
                                            }}
                                            disabled={loading}
                                            className="profile-btn secondary"
                                        >
                                            <FaTimes />
                                            Annuler
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="profile-info-section">
                                    <div className="profile-info-item">
                                        <FaIdCard className="profile-info-icon" />
                                        <div className="profile-info-content">
                                            <span className="profile-info-label">Nom d'utilisateur</span>
                                            <span className="profile-info-value">{user.username}</span>
                                        </div>
                                    </div>

                                    <div className="profile-info-item">
                                        <FaEnvelope className="profile-info-icon" />
                                        <div className="profile-info-content">
                                            <span className="profile-info-label">Email</span>
                                            <span className="profile-info-value">{user.email}</span>
                                        </div>
                                    </div>

                                    <div className="profile-info-item">
                                        <FaPhone className="profile-info-icon" />
                                        <div className="profile-info-content">
                                            <span className="profile-info-label">Téléphone</span>
                                            <span className="profile-info-value">{user.telephone || 'Non renseigné'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Informations académiques */}
                        <div className="profile-card academic-info">
                            <div className="profile-card-header">
                                <h3 className="profile-card-title">
                                    <FaUniversity className="profile-card-icon" />
                                    Informations académiques
                                </h3>
                            </div>

                            <div className="profile-info-section">
                                <div className="profile-info-item">
                                    <FaIdCard className="profile-info-icon" />
                                    <div className="profile-info-content">
                                        <span className="profile-info-label">Matricule</span>
                                        <span className="profile-info-value">{user.matricule}</span>
                                    </div>
                                </div>

                                <div className="profile-info-item">
                                    <FaUserTie className="profile-info-icon" />
                                    <div className="profile-info-content">
                                        <span className="profile-info-label">Rôle</span>
                                        <span className="profile-info-value profile-capitalize">{user.role}</span>
                                    </div>
                                </div>

                                <div className="profile-info-item">
                                    <FaUniversity className="profile-info-icon" />
                                    <div className="profile-info-content">
                                        <span className="profile-info-label">Faculté</span>
                                        <span className="profile-info-value profile-capitalize">{user.faculte}</span>
                                    </div>
                                </div>

                                <div className="profile-info-item">
                                    <FaUniversity className="profile-info-icon" />
                                    <div className="profile-info-content">
                                        <span className="profile-info-label">Université</span>
                                        <span className="profile-info-value">{user.universite}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Informations personnelles */}
                        <div className="profile-card personal-info">
                            <div className="profile-card-header">
                                <h3 className="profile-card-title">
                                    <FaUser className="profile-card-icon" />
                                    Informations personnelles
                                </h3>
                            </div>

                            <div className="profile-info-section">
                                <div className="profile-info-item">
                                    <FaVenusMars className="profile-info-icon" />
                                    <div className="profile-info-content">
                                        <span className="profile-info-label">Sexe</span>
                                        <span className="profile-info-value profile-capitalize">{user.sexe}</span>
                                    </div>
                                </div>

                                <div className="profile-info-item">
                                    <FaMapMarkerAlt className="profile-info-icon" />
                                    <div className="profile-info-content">
                                        <span className="profile-info-label">Province</span>
                                        <span className="profile-info-value">{user.province}</span>
                                    </div>
                                </div>

                                <div className="profile-info-item">
                                    <FaCalendar className="profile-info-icon" />
                                    <div className="profile-info-content">
                                        <span className="profile-info-label">Date d'inscription</span>
                                        <span className="profile-info-value">
                                            {user.date_inscription ? 
                                                new Date(user.date_inscription).toLocaleDateString('fr-FR', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                }) : 'Non renseignée'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions rapides */}
                        <div className="profile-card quick-actions">
                            <div className="profile-card-header">
                                <h3 className="profile-card-title">
                                    Actions rapides
                                </h3>
                            </div>

                            <div className="profile-actions-grid">
                                <button 
                                    className="profile-action-btn"
                                    onClick={() => navigate('/favoris')}
                                >
                                    <FaHeart className="profile-action-icon" />
                                    <div className="profile-action-content">
                                        <span className="profile-action-title">Mes Favoris</span>
                                        <span className="profile-action-subtitle">Gérer mes ressources favorites</span>
                                    </div>
                                </button>

                                <button 
                                    className="profile-action-btn"
                                    onClick={() => setChangingPassword(true)}
                                >
                                    <FaKey className="profile-action-icon" />
                                    <div className="profile-action-content">
                                        <span className="profile-action-title">Mot de passe</span>
                                        <span className="profile-action-subtitle">Modifier mon mot de passe</span>
                                    </div>
                                </button>

                                <button 
                                    className="profile-action-btn"
                                    onClick={goToHome}
                                >
                                    <FaUniversity className="profile-action-icon" />
                                    <div className="profile-action-content">
                                        <span className="profile-action-title">Ressources</span>
                                        <span className="profile-action-subtitle">Parcourir les ressources</span>
                                    </div>
                                </button>
                            </div>

                            <div className="profile-logout-section">
                                <button 
                                    className="profile-logout-btn"
                                    onClick={handleLogout}
                                >
                                    Se déconnecter
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal de changement de mot de passe */}
                {changingPassword && (
                    <div className="profile-password-modal">
                        <div className="profile-password-modal-content">
                            <div className="profile-password-modal-header">
                                <h3 className="profile-password-modal-title">
                                    <FaLock />
                                    Modifier le mot de passe
                                </h3>
                                <button
                                    onClick={cancelPasswordChange}
                                    className="profile-password-modal-close"
                                    disabled={passwordLoading}
                                >
                                    <FaTimes />
                                </button>
                            </div>

                            <form onSubmit={handlePasswordSubmit} className="profile-password-form">
                                <div className="profile-password-form-group">
                                    <label className="profile-password-form-label">
                                        <FaLock />
                                        Ancien mot de passe
                                    </label>
                                    <input
                                        type="password"
                                        name="oldPassword"
                                        value={passwordData.oldPassword}
                                        onChange={handlePasswordInputChange}
                                        className="profile-password-form-input"
                                        disabled={passwordLoading}
                                        required
                                        placeholder="Entrez votre ancien mot de passe"
                                    />
                                </div>

                                <div className="profile-password-form-group">
                                    <label className="profile-password-form-label">
                                        <FaKey />
                                        Nouveau mot de passe
                                    </label>
                                    <input
                                        type="password"
                                        name="newPassword"
                                        value={passwordData.newPassword}
                                        onChange={handlePasswordInputChange}
                                        className="profile-password-form-input"
                                        disabled={passwordLoading}
                                        required
                                        minLength="8"
                                        placeholder="Au moins 8 caractères"
                                    />
                                </div>

                                <div className="profile-password-form-group">
                                    <label className="profile-password-form-label">
                                        <FaKey />
                                        Confirmer le nouveau mot de passe
                                    </label>
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        value={passwordData.confirmPassword}
                                        onChange={handlePasswordInputChange}
                                        className="profile-password-form-input"
                                        disabled={passwordLoading}
                                        required
                                        minLength="8"
                                        placeholder="Répétez le nouveau mot de passe"
                                    />
                                </div>

                                <div className="profile-password-form-actions">
                                    <button
                                        type="submit"
                                        disabled={passwordLoading}
                                        className="profile-btn primary"
                                    >
                                        <FaSave />
                                        {passwordLoading ? 'Modification...' : 'Modifier le mot de passe'}
                                    </button>
                                    
                                    <button
                                        type="button"
                                        onClick={cancelPasswordChange}
                                        disabled={passwordLoading}
                                        className="profile-btn secondary"
                                    >
                                        <FaTimes />
                                        Annuler
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Profile;
