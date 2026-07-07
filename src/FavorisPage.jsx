import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FaHeart, 
    FaTrash, 
    FaEye,
    FaFilePdf,
    FaFileVideo,
    FaFileImage,
    FaFileAlt,
    FaTags,
    FaCalendar,
    FaSearch,
    FaTimes
} from 'react-icons/fa';
import { favorisAPI } from './api';
import { isAuthenticated } from './utils/auth';
import { getMediaUrl } from './config';
import { useToast } from './hooks/useToast';
import { ToastContainer } from './components/ToastContainer';
import AppNavigation from './components/AppNavigation';
import { addLocalHistoryItem } from './utils/localHistory';

const FavorisPage = () => {
    const [favoris, setFavoris] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [deletingIds, setDeletingIds] = useState(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [favoriteToDelete, setFavoriteToDelete] = useState(null);
    const navigate = useNavigate();
    const { toasts, removeToast, showError } = useToast();

    // Charger les favoris au montage du composant
    useEffect(() => {
        if (!isAuthenticated()) {
            navigate('/login');
            return;
        }
        fetchFavoris();
    }, [navigate]);

    useEffect(() => {
        const query = searchTerm.trim();
        if (query.length < 2) return;

        const timer = setTimeout(() => {
            addLocalHistoryItem({
                type: 'search',
                title: query,
                description: 'Recherche effectuée dans les favoris',
                url: '/favoris',
                icon: 'search',
                metadata: { query: `favoris:${query}` }
            });
        }, 450);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Récupérer la liste des favoris
    const fetchFavoris = async () => {
        try {
            setLoading(true);
            setLoadError(false);
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
            
            // console.log('Favoris chargés:', favorisData);
            setFavoris(favorisData);
        } catch (error) {
            console.error('Erreur lors du chargement des favoris:', error);
            showError('Erreur lors du chargement de vos favoris');
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    };

    // Supprimer un favori
    const handleDeleteFavorite = async (ressourceId, ressourceTitre) => {
        try {
            setDeletingIds(prev => new Set([...prev, ressourceId]));
            await favorisAPI.removeFavori(ressourceId);
            
            // Mettre à jour la liste locale
            setFavoris(prev => prev.filter(favori => {
                const id = favori.ressource?.id || favori.ressource_id || favori.id;
                return id !== ressourceId;
            }));
            window.dispatchEvent(new Event('favorites:changed'));
            addLocalHistoryItem({
                type: 'favorite',
                title: ressourceTitre,
                description: 'Ressource retirée des favoris',
                url: `/ressources/${ressourceId}`,
                icon: 'favorite',
                metadata: { resourceId: ressourceId, action: 'removed' }
            });
            
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

    const requestDeleteFavorite = (ressourceId, ressourceTitre) => {
        setFavoriteToDelete({ id: ressourceId, title: ressourceTitre });
    };

    const closeDeleteModal = () => {
        setFavoriteToDelete(null);
    };

    const confirmDeleteFavorite = async () => {
        if (!favoriteToDelete) return;
        const { id, title } = favoriteToDelete;
        setFavoriteToDelete(null);
        await handleDeleteFavorite(id, title);
    };

    // Naviguer vers les détails d'une ressource
    const handleViewResource = (ressource) => {
        addLocalHistoryItem({
            type: 'resource',
            title: ressource.titre || 'Ressource consultée',
            description: 'Ouverte depuis les favoris',
            url: `/ressources/${ressource.id}`,
            icon: 'resource',
            metadata: { resourceId: ressource.id }
        });
        navigate(`/ressources/${ressource.id}`, { state: { ressource } });
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

    const getRessourceFromFavori = (favori) => favori.ressource || favori;

    const filteredFavoris = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        if (!normalizedSearch) return favoris;

        return favoris.filter((favori) => {
            const ressource = getRessourceFromFavori(favori);
            const searchableText = [
                ressource.titre,
                ressource.sous_titre,
                ressource.type,
                ressource.format,
                ressource.domaine?.nom,
                ressource.auteur,
                ressource.description
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return searchableText.includes(normalizedSearch);
        });
    }, [favoris, searchTerm]);

    const favoriteCountLabel = `${favoris.length} favori${favoris.length > 1 ? 's' : ''}`;
    const resultCountLabel = `${filteredFavoris.length} résultat${filteredFavoris.length > 1 ? 's' : ''}`;

    if (loading) {
        return (
            <div className="favoris-page">
                <AppNavigation />
                
                <div className="favoris-main">
                    <div className="favoris-hero favoris-hero-loading">
                        <div>
                            <div className="favoris-loading-title"></div>
                            <div className="favoris-loading-subtitle"></div>
                        </div>
                        <div className="favoris-loading-search"></div>
                    </div>
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
            <ToastContainer toasts={toasts} onClose={removeToast} />
            <AppNavigation favoriteCountOverride={favoris.length} />

            {/* Contenu principal */}
            <div className="favoris-main">
                <section className="favoris-hero" aria-labelledby="favoris-page-title">
                    <div className="favoris-hero-copy">
                        <span className="favoris-eyebrow">
                            <FaHeart />
                            Bibliothèque personnelle
                        </span>
                        <h1 id="favoris-page-title" className="favoris-page-title">Favoris</h1>
                        <p className="favoris-page-subtitle">
                            Retrouvez rapidement les ressources que vous avez mises de côté pour votre travail.
                        </p>
                    </div>

                </section>

                {!loadError && favoris.length > 0 && (
                    <section className="favoris-toolbar" aria-label="Recherche dans les favoris">
                        <div className="favoris-search">
                            <FaSearch className="favoris-search-icon" />
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Rechercher par titre, domaine, type..."
                                aria-label="Rechercher dans mes favoris"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    className="favoris-search-clear"
                                    onClick={() => setSearchTerm('')}
                                    aria-label="Effacer la recherche"
                                >
                                    <FaTimes />
                                </button>
                            )}
                        </div>
                        <div className="favoris-toolbar-meta">
                            <span>{searchTerm ? resultCountLabel : favoriteCountLabel}</span>
                        </div>
                    </section>
                )}

                {loadError && (
                    <div className="favoris-error">
                        <div className="favoris-error-content">
                            <FaFileAlt className="favoris-error-icon" />
                            <h3>Erreur de chargement</h3>
                            <p>Impossible d'afficher vos favoris pour le moment.</p>
                            <button 
                                className="favoris-retry-btn"
                                onClick={fetchFavoris}
                            >
                                Réessayer
                            </button>
                        </div>
                    </div>
                )}

                {!loadError && favoris.length === 0 && (
                    <div className="favoris-empty">
                        <div className="favoris-empty-content">
                            <FaHeart className="favoris-empty-icon" />
                            <h3 className="favoris-empty-title">Aucun favori pour le moment</h3>
                            <p className="favoris-empty-text">
                                Explorez les ressources et ajoutez-les à vos favoris en cliquant sur le cœur.
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

                {!loadError && favoris.length > 0 && filteredFavoris.length === 0 && (
                    <div className="favoris-empty favoris-empty-search">
                        <div className="favoris-empty-content">
                            <FaSearch className="favoris-empty-icon" />
                            <h3 className="favoris-empty-title">Aucun résultat</h3>
                            <p className="favoris-empty-text">
                                Aucun favori ne correspond à "{searchTerm}". Essayez un autre mot-clé.
                            </p>
                            <button 
                                className="favoris-browse-btn"
                                onClick={() => setSearchTerm('')}
                            >
                                Effacer la recherche
                            </button>
                        </div>
                    </div>
                )}

                {!loadError && filteredFavoris.length > 0 && (
                    <div className="favoris-grid">
                        {filteredFavoris.map((favori, index) => {
                            // Extraire les données de la ressource selon la structure
                            const ressource = getRessourceFromFavori(favori);
                            const ressourceId = ressource.id || favori.ressource_id;
                            const isDeleting = deletingIds.has(ressourceId);
                            
                            return (
                                <article
                                    key={ressourceId}
                                    className={`favoris-card ${isDeleting ? 'deleting' : ''}`}
                                    style={{ animationDelay: `${Math.min(index * 35, 280)}ms` }}
                                >
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
                                            <FaFileAlt />
                                        </div>
                                        
                                        {/* Icône de format */}
                                        <div className="favoris-format-icon">
                                            {getFormatIcon(ressource.format)}
                                        </div>
                                    </div>

                                    {/* Contenu de la carte */}
                                    <div className="favoris-card-content">
                                        <div className="favoris-card-kicker">
                                            <span>{ressource.type || 'Ressource'}</span>
                                            {ressource.format && <span>{ressource.format}</span>}
                                        </div>
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
                                                onClick={() => handleViewResource(ressource)}
                                                title="Voir les détails"
                                            >
                                                <FaEye />
                                                Voir
                                            </button>
                                            
                                            <button
                                                className="favoris-action-btn favoris-delete-btn"
                                                onClick={() => requestDeleteFavorite(ressourceId, ressource.titre)}
                                                disabled={isDeleting}
                                                title="Retirer des favoris"
                                            >
                                                <FaTrash />
                                                {isDeleting ? 'Suppression...' : 'Retirer'}
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>

            {favoriteToDelete && (
                <div
                    className="favoris-confirm-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="favoris-confirm-title"
                    onClick={closeDeleteModal}
                >
                    <div className="favoris-confirm-modal" onClick={(event) => event.stopPropagation()}>
                        <button
                            type="button"
                            className="favoris-confirm-close"
                            onClick={closeDeleteModal}
                            aria-label="Fermer"
                        >
                            <FaTimes />
                        </button>
                        <div className="favoris-confirm-icon">
                            <FaHeart />
                        </div>
                        <h2 id="favoris-confirm-title">Retirer ce favori ?</h2>
                        <p>
                            Vous allez retirer <strong>{favoriteToDelete.title}</strong> de vos favoris.
                        </p>
                        <div className="favoris-confirm-actions">
                            <button
                                type="button"
                                className="favoris-confirm-secondary"
                                onClick={closeDeleteModal}
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                className="favoris-confirm-danger"
                                onClick={confirmDeleteFavorite}
                            >
                                <FaTrash />
                                Retirer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FavorisPage;
