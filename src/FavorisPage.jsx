import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FaArrowLeft, 
    FaHeart, 
    FaTrash, 
    FaEye,
    FaFilePdf,
    FaFileVideo,
    FaFileImage,
    FaFileAlt,
    FaTags,
    FaCalendar
} from 'react-icons/fa';
import { favorisAPI } from './api';
import { isAuthenticated, getCurrentUser } from './utils/auth';
import { getMediaUrl } from './config';

const FavorisPage = () => {
    const [favoris, setFavoris] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deletingIds, setDeletingIds] = useState(new Set());
    const navigate = useNavigate();
    const user = getCurrentUser();

    // Charger les favoris au montage du composant
    useEffect(() => {
        if (!isAuthenticated()) {
            navigate('/login');
            return;
        }
        fetchFavoris();
    }, [navigate]);

    // Récupérer la liste des favoris
    const fetchFavoris = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await favorisAPI.getFavoris();
            
            // Gérer différentes structures de réponse
            let favorisData = [];
            if (response.results) {
                favorisData = response.results.data || response.results || [];
            } else if (response.data) {
                favorisData = response.data;
            } else if (Array.isArray(response)) {
                favorisData = response;
            }
            
            console.log('Favoris chargés:', favorisData);
            setFavoris(favorisData);
        } catch (error) {
            console.error('Erreur lors du chargement des favoris:', error);
            setError('Erreur lors du chargement de vos favoris');
        } finally {
            setLoading(false);
        }
    };

    // Supprimer un favori
    const handleDeleteFavorite = async (ressourceId, ressourceTitre) => {
        const confirmDelete = window.confirm(`Voulez-vous vraiment retirer "${ressourceTitre}" de vos favoris ?`);
        if (!confirmDelete) return;

        try {
            setDeletingIds(prev => new Set([...prev, ressourceId]));
            await favorisAPI.removeFavori(ressourceId);
            
            // Mettre à jour la liste locale
            setFavoris(prev => prev.filter(favori => {
                const id = favori.ressource?.id || favori.ressource_id || favori.id;
                return id !== ressourceId;
            }));
            
            showNotification(`"${ressourceTitre}" retiré des favoris`, 'success');
        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
            showNotification(error.message, 'error');
        } finally {
            setDeletingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(ressourceId);
                return newSet;
            });
        }
    };

    // Naviguer vers les détails d'une ressource
    const handleViewResource = (ressourceId) => {
        navigate(`/ressources/${ressourceId}`);
    };

    // Afficher une notification
    const showNotification = (message, type = 'success') => {
        const notification = document.createElement('div');
        notification.className = `favorite-notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${type === 'success' ? '✅' : '❌'}</span>
                <span class="notification-text">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 3000);
    };

    // Obtenir l'icône selon le format
    const getFormatIcon = (format) => {
        if (!format) return <FaFileAlt className="text-gray-500" />;
        
        const formatLower = format.toLowerCase();
        if (formatLower === 'pdf') return <FaFilePdf className="text-red-500" />;
        if (['mp4', 'avi', 'mov'].includes(formatLower)) return <FaFileVideo className="text-blue-500" />;
        if (['png', 'jpg', 'jpeg', 'gif'].includes(formatLower)) return <FaFileImage className="text-green-500" />;
        
        return <FaFileAlt className="text-gray-500" />;
    };

    // Formater la date
    const formatDate = (dateString) => {
        if (!dateString) return 'Date inconnue';
        return new Date(dateString).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="favoris-page">
                <div className="favoris-header">
                    <div className="favoris-header-content">
                        <button
                            onClick={() => navigate('/')}
                            className="favoris-back-btn"
                        >
                            <FaArrowLeft />
                            Retour à l'accueil
                        </button>
                        <div className="favoris-title-section">
                            <h1 className="favoris-title">
                                <FaHeart className="favoris-title-icon" />
                                Mes Favoris
                            </h1>
                            <p className="favoris-subtitle">Chargement de vos ressources favorites...</p>
                        </div>
                    </div>
                </div>
                
                <div className="favoris-main">
                    <div className="favoris-loading-grid">
                        {[...Array(6)].map((_, index) => (
                            <div key={index} className="favoris-loading-card">
                                <div className="favoris-loading-image"></div>
                                <div className="favoris-loading-content">
                                    <div className="favoris-loading-title"></div>
                                    <div className="favoris-loading-subtitle"></div>
                                    <div className="favoris-loading-badges">
                                        <div className="favoris-loading-badge"></div>
                                        <div className="favoris-loading-badge"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="favoris-page">
            {/* En-tête */}
            <div className="favoris-header">
                <div className="favoris-header-content">
                    <button
                        onClick={() => navigate('/')}
                        className="favoris-back-btn"
                    >
                        <FaArrowLeft />
                        Retour à l'accueil
                    </button>
                    <div className="favoris-title-section">
                        <h1 className="favoris-title">
                            <FaHeart className="favoris-title-icon" />
                            Mes Favoris
                        </h1>
                        <p className="favoris-subtitle">
                            {favoris.length > 0 
                                ? `${favoris.length} ressource${favoris.length > 1 ? 's' : ''} favorite${favoris.length > 1 ? 's' : ''}` 
                                : 'Aucune ressource favorite'
                            }
                        </p>
                    </div>
                </div>
            </div>

            {/* Contenu principal */}
            <div className="favoris-main">
                {error && (
                    <div className="favoris-error">
                        <div className="favoris-error-content">
                            <span className="favoris-error-icon">❌</span>
                            <h3>Erreur de chargement</h3>
                            <p>{error}</p>
                            <button 
                                className="favoris-retry-btn"
                                onClick={fetchFavoris}
                            >
                                Réessayer
                            </button>
                        </div>
                    </div>
                )}

                {!error && favoris.length === 0 && (
                    <div className="favoris-empty">
                        <div className="favoris-empty-content">
                            <FaHeart className="favoris-empty-icon" />
                            <h3 className="favoris-empty-title">Aucun favori pour le moment</h3>
                            <p className="favoris-empty-text">
                                Explorez les ressources et ajoutez-les à vos favoris en cliquant sur le cœur ❤️
                            </p>
                            <button 
                                className="favoris-browse-btn"
                                onClick={() => navigate('/')}
                            >
                                Parcourir les ressources
                            </button>
                        </div>
                    </div>
                )}

                {!error && favoris.length > 0 && (
                    <div className="favoris-grid">
                        {favoris.map((favori) => {
                            // Extraire les données de la ressource selon la structure
                            const ressource = favori.ressource || favori;
                            const ressourceId = ressource.id || favori.ressource_id;
                            const isDeleting = deletingIds.has(ressourceId);
                            
                            return (
                                <div key={ressourceId} className={`favoris-card ${isDeleting ? 'deleting' : ''}`}>
                                    {/* Image de couverture */}
                                    <div className="favoris-card-image">
                                        {ressource.couverture ? (
                                            <img 
                                                src={getMediaUrl(ressource.couverture)}
                                                alt={ressource.titre}
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        <div 
                                            className="favoris-card-placeholder"
                                            style={{display: ressource.couverture ? 'none' : 'flex'}}
                                        >
                                            📄
                                        </div>
                                        
                                        {/* Icône de format */}
                                        <div className="favoris-format-icon">
                                            {getFormatIcon(ressource.format)}
                                        </div>
                                    </div>

                                    {/* Contenu de la carte */}
                                    <div className="favoris-card-content">
                                        <h3 className="favoris-card-title" title={ressource.titre}>
                                            {ressource.titre}
                                        </h3>

                                        <div className="favoris-card-badges">
                                            {ressource.domaine?.nom && (
                                                <span className="favoris-badge favoris-badge-domain">
                                                    <FaTags size={10} />
                                                    {ressource.domaine.nom}
                                                </span>
                                            )}
                                            
                                            {ressource.type && (
                                                <span className="favoris-badge favoris-badge-type">
                                                    {ressource.type}
                                                </span>
                                            )}

                                            {ressource.date_publication && (
                                                <span className="favoris-badge favoris-badge-date">
                                                    <FaCalendar size={10} />
                                                    {formatDate(ressource.date_publication)}
                                                </span>
                                            )}
                                        </div>

                                        <div className="favoris-card-actions">
                                            <button
                                                className="favoris-action-btn favoris-view-btn"
                                                onClick={() => handleViewResource(ressourceId)}
                                                title="Voir les détails"
                                            >
                                                <FaEye />
                                                Voir
                                            </button>
                                            
                                            <button
                                                className="favoris-action-btn favoris-delete-btn"
                                                onClick={() => handleDeleteFavorite(ressourceId, ressource.titre)}
                                                disabled={isDeleting}
                                                title="Retirer des favoris"
                                            >
                                                <FaTrash />
                                                {isDeleting ? 'Suppression...' : 'Retirer'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FavorisPage;