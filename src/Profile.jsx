import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, logout, isAuthenticated, saveSession } from './utils/auth';
import { userAPI } from './services/api';

function Profile() {
    const [user, setUser] = useState(null);
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [formData, setFormData] = useState({});
    const navigate = useNavigate();

    useEffect(() => {
        // Check if user is authenticated
        if (!isAuthenticated()) {
            navigate('/login');
            return;
        }

        // Get current user data
        const currentUser = getCurrentUser();
        setUser(currentUser);
        setFormData({
            nom: currentUser.nom || '',
            prenom: currentUser.prenom || '',
            telephone: currentUser.telephone || '',
            email: currentUser.email || '',
        });
    }, [navigate]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const goToHome = () => {
        navigate('/home');
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            // This is an example - you'd need to implement the actual update API
            console.log('Updating profile with:', formData);
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Update local user data
            const updatedUser = { ...user, ...formData };
            const currentSession = JSON.parse(localStorage.getItem('userData'));
            const token = localStorage.getItem('authToken');
            
            saveSession(token, updatedUser);
            setUser(updatedUser);
            
            setSuccess('Profil mis à jour avec succès !');
            setEditing(false);
        } catch (err) {
            console.error('Profile update error:', err);
            setError('Erreur lors de la mise à jour du profil');
        } finally {
            setLoading(false);
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
        <div className="profile-page">
            {/* Header */}
            <header className="app-header">
                <div>
                    <h1>Mon Profil</h1>
                    <p className="app-header-subtitle">Gérer vos informations personnelles</p>
                </div>
                
                <div className="nav-buttons">
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
                </div>
            </header>

            {/* Main Content */}
            <main className="profile-main">
                {/* Messages */}
                {error && (
                    <div className="alert alert-error">
                        {error}
                    </div>
                )}
                
                {success && (
                    <div className="alert alert-success">
                        {success}
                    </div>
                )}

                {/* Profile Card */}
                <div className="profile-card">
                    <div className="profile-header">
                        <h2 className="profile-title">Informations personnelles</h2>
                        {!editing && (
                            <button
                                onClick={() => setEditing(true)}
                                className="btn btn-success"
                            >
                                Modifier
                            </button>
                        )}
                    </div>

                    {editing ? (
                        <form onSubmit={handleSubmit} className="profile-form">
                            <div className="profile-form-group">
                                <label className="form-label">
                                    Nom
                                </label>
                                <input
                                    type="text"
                                    name="nom"
                                    value={formData.nom}
                                    onChange={handleInputChange}
                                    className="form-input"
                                    disabled={loading}
                                />
                            </div>

                            <div className="profile-form-group">
                                <label className="form-label">
                                    Prénom
                                </label>
                                <input
                                    type="text"
                                    name="prenom"
                                    value={formData.prenom}
                                    onChange={handleInputChange}
                                    className="form-input"
                                    disabled={loading}
                                />
                            </div>

                            <div className="profile-form-group">
                                <label className="form-label">
                                    Téléphone
                                </label>
                                <input
                                    type="tel"
                                    name="telephone"
                                    value={formData.telephone}
                                    onChange={handleInputChange}
                                    className="form-input"
                                    disabled={loading}
                                />
                            </div>

                            <div className="profile-form-group">
                                <label className="form-label">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    className="form-input"
                                    disabled={loading}
                                />
                            </div>

                            <div className="profile-form-actions">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn btn-primary btn-lg"
                                >
                                    {loading ? 'Enregistrement...' : 'Enregistrer'}
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditing(false);
                                        setError('');
                                        setSuccess('');
                                        // Reset form data
                                        setFormData({
                                            nom: user.nom || '',
                                            prenom: user.prenom || '',
                                            telephone: user.telephone || '',
                                            email: user.email || '',
                                        });
                                    }}
                                    disabled={loading}
                                    className="btn btn-secondary btn-lg"
                                >
                                    Annuler
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div>
                            <div className="profile-info-grid">
                                <strong>Nom d'utilisateur:</strong>
                                <span>{user.username}</span>
                                
                                <strong>Nom:</strong>
                                <span>{user.nom || 'Non renseigné'}</span>
                                
                                <strong>Prénom:</strong>
                                <span>{user.prenom || 'Non renseigné'}</span>
                                
                                <strong>Email:</strong>
                                <span>{user.email}</span>
                                
                                <strong>Téléphone:</strong>
                                <span>{user.telephone || 'Non renseigné'}</span>
                                
                                <strong>Matricule:</strong>
                                <span>{user.matricule}</span>
                                
                                <strong>Rôle:</strong>
                                <span className="profile-field-capitalize">{user.role}</span>
                                
                                <strong>Sexe:</strong>
                                <span className="profile-field-capitalize">{user.sexe}</span>
                                
                                <strong>Faculté:</strong>
                                <span className="profile-field-capitalize">{user.faculte}</span>
                                
                                <strong>Province:</strong>
                                <span>{user.province}</span>
                                
                                <strong>Université:</strong>
                                <span>{user.universite}</span>
                                
                                <strong>Date d'inscription:</strong>
                                <span>{new Date(user.date_inscription).toLocaleDateString('fr-FR')}</span>
                            </div>

                            {user.avatar_url && (
                                <div className="profile-avatar-section">
                                    <img 
                                        src={`http://localhost:8000${user.avatar_url}`} 
                                        alt="Avatar" 
                                        className="profile-avatar"
                                    />
                                    <p className="profile-avatar-caption">
                                        Photo de profil
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default Profile;