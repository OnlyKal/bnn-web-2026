import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    FaArrowLeft, 
    FaDownload, 
    FaEye, 
    FaBook,
    FaCalendar,
    FaGlobe,
    FaLanguage,
    FaUser,
    FaMapMarkerAlt,
    FaTags,
    FaFilePdf,
    FaFileVideo,
    FaFileImage,
    FaFileAlt,
    FaBarcode
} from 'react-icons/fa';
import api from './api';
import { isAuthenticated } from './utils/auth';

const ResourceDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [resource, setResource] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Check if user is authenticated
        if (!isAuthenticated()) {
            navigate('/login');
            return;
        }

        fetchResourceDetail();
    }, [id, navigate]);

    const fetchResourceDetail = async () => {
        try {
            setLoading(true);
            setError(null);

            // Try to fetch from API
            try {
                const response = await api.get(`/ressources/${id}/`);
                console.log('Resource detail response:', response.data);
                setResource(response.data);
            } catch (apiError) {
                console.error('API error:', apiError);
                setError('Impossible de charger les détails de la ressource');
            }
        } catch (error) {
            console.error('Error loading resource:', error);
            setError('Une erreur est survenue lors du chargement');
        } finally {
            setLoading(false);
        }
    };

    // Helper function to get format icon
    const getFormatIcon = (format) => {
        switch (format?.toLowerCase()) {
            case 'pdf':
                return <FaFilePdf className="resource-detail-format-icon pdf" />;
            case 'video':
            case 'mp4':
            case 'avi':
                return <FaFileVideo className="resource-detail-format-icon video" />;
            case 'image':
            case 'jpg':
            case 'png':
            case 'gif':
                return <FaFileImage className="resource-detail-format-icon image" />;
            default:
                return <FaFileAlt className="resource-detail-format-icon default" />;
        }
    };

    const handleDownload = (file) => {
        if (file && file.fichier) {
            const fileUrl = `http://localhost:8000${file.fichier}`;
            const link = document.createElement('a');
            link.href = fileUrl;
            link.download = file.titre || resource.titre;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleViewFile = (file) => {
        if (file && file.fichier) {
            const fileUrl = `http://localhost:8000${file.fichier}`;
            window.open(fileUrl, '_blank');
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Non spécifiée';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

    const stripHtmlTags = (html) => {
        if (!html) return '';
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    };

    if (loading) {
        return (
            <div className="resource-detail-container">
                <div className="resource-detail-loading">
                    <div className="resource-detail-spinner"></div>
                    <p>Chargement des détails...</p>
                </div>
            </div>
        );
    }

    if (error || !resource) {
        return (
            <div className="resource-detail-container">
                <div className="resource-detail-error">
                    <h2>Erreur</h2>
                    <p>{error || 'Ressource introuvable'}</p>
                    <button 
                        className="resource-detail-back-btn"
                        onClick={() => navigate('/')}
                    >
                        <FaArrowLeft />
                        Retour à l'accueil
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="resource-detail-container">
            {/* Header with back button */}
            <div className="resource-detail-header">
                <button 
                    className="resource-detail-back-btn"
                    onClick={() => navigate('/')}
                >
                    <FaArrowLeft />
                    Retour
                </button>
                <h1 className="resource-detail-page-title">Détails de la ressource</h1>
            </div>

            <div className="resource-detail-content">
                {/* Main content */}
                <div className="resource-detail-main">
                    {/* Cover image and basic info */}
                    <div className="resource-detail-hero">
                        <div className="resource-detail-cover">
                            {resource.couverture ? (
                                <img 
                                    src={`http://localhost:8000${resource.couverture}`}
                                    alt={resource.titre}
                                    className="resource-detail-cover-img"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                    }}
                                />
                            ) : null}
                            <div 
                                className="resource-detail-cover-placeholder"
                                style={{display: resource.couverture ? 'none' : 'flex'}}
                            >
                                <FaBook size={64} />
                            </div>
                        </div>

                        <div className="resource-detail-basic-info">
                            <h1 className="resource-detail-title">{resource.titre}</h1>
                            {resource.sous_titre && (
                                <h2 className="resource-detail-subtitle">{resource.sous_titre}</h2>
                            )}
                            
                            <div className="resource-detail-meta">
                                <div className="resource-detail-badges">
                                    {resource.type && (
                                        <span className="resource-detail-badge type">
                                            <FaTags />
                                            {resource.type}
                                        </span>
                                    )}
                                    {resource.format && (
                                        <span className="resource-detail-badge format">
                                            {getFormatIcon(resource.format)}
                                            {resource.format.toUpperCase()}
                                        </span>
                                    )}
                                    {resource.langue && (
                                        <span className="resource-detail-badge language">
                                            <FaLanguage />
                                            {resource.langue.toUpperCase()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    {resource.description && (
                        <div className="resource-detail-section">
                            <h3 className="resource-detail-section-title">Description</h3>
                            <div className="resource-detail-description">
                                <p>{stripHtmlTags(resource.description)}</p>
                            </div>
                        </div>
                    )}

                    {/* Files section */}
                    {resource.fichiers && resource.fichiers.length > 0 && (
                        <div className="resource-detail-section">
                            <h3 className="resource-detail-section-title">Fichiers disponibles</h3>
                            <div className="resource-detail-files">
                                {resource.fichiers.map((file, index) => (
                                    <div key={index} className="resource-detail-file">
                                        <div className="resource-detail-file-info">
                                            {getFormatIcon(resource.format)}
                                            <span className="resource-detail-file-name">
                                                {file.titre || resource.titre}
                                            </span>
                                        </div>
                                        <div className="resource-detail-file-actions">
                                            <button 
                                                className="resource-detail-file-btn view"
                                                onClick={() => handleViewFile(file)}
                                                title="Voir le fichier"
                                            >
                                                <FaEye />
                                                Voir
                                            </button>
                                            <button 
                                                className="resource-detail-file-btn download"
                                                onClick={() => handleDownload(file)}
                                                title="Télécharger le fichier"
                                            >
                                                <FaDownload />
                                                Télécharger
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar with detailed information */}
                <div className="resource-detail-sidebar">
                    <div className="resource-detail-info-card">
                        <h3 className="resource-detail-card-title">Informations détaillées</h3>
                        
                        <div className="resource-detail-info-list">
                            {resource.auteurs && (
                                <div className="resource-detail-info-item">
                                    <FaUser className="resource-detail-info-icon" />
                                    <div>
                                        <span className="resource-detail-info-label">Auteur(s)</span>
                                        <span className="resource-detail-info-value">{resource.auteurs}</span>
                                    </div>
                                </div>
                            )}

                            {resource.edition && (
                                <div className="resource-detail-info-item">
                                    <FaBook className="resource-detail-info-icon" />
                                    <div>
                                        <span className="resource-detail-info-label">Édition</span>
                                        <span className="resource-detail-info-value">{resource.edition}</span>
                                    </div>
                                </div>
                            )}

                            {resource.lieu_edition && (
                                <div className="resource-detail-info-item">
                                    <FaMapMarkerAlt className="resource-detail-info-icon" />
                                    <div>
                                        <span className="resource-detail-info-label">Lieu d'édition</span>
                                        <span className="resource-detail-info-value">{resource.lieu_edition}</span>
                                    </div>
                                </div>
                            )}

                            {resource.pays && (
                                <div className="resource-detail-info-item">
                                    <FaGlobe className="resource-detail-info-icon" />
                                    <div>
                                        <span className="resource-detail-info-label">Pays</span>
                                        <span className="resource-detail-info-value">{resource.pays}</span>
                                    </div>
                                </div>
                            )}

                            {resource.ISBN && (
                                <div className="resource-detail-info-item">
                                    <FaBarcode className="resource-detail-info-icon" />
                                    <div>
                                        <span className="resource-detail-info-label">ISBN</span>
                                        <span className="resource-detail-info-value">{resource.ISBN}</span>
                                    </div>
                                </div>
                            )}

                            {resource.date_publication && (
                                <div className="resource-detail-info-item">
                                    <FaCalendar className="resource-detail-info-icon" />
                                    <div>
                                        <span className="resource-detail-info-label">Date de publication</span>
                                        <span className="resource-detail-info-value">{formatDate(resource.date_publication)}</span>
                                    </div>
                                </div>
                            )}

                            {resource.domaine && (
                                <div className="resource-detail-info-item">
                                    <FaTags className="resource-detail-info-icon" />
                                    <div>
                                        <span className="resource-detail-info-label">Domaine</span>
                                        <span className="resource-detail-info-value">{resource.domaine.nom}</span>
                                    </div>
                                </div>
                            )}

                            {resource.sous_domaine && (
                                <div className="resource-detail-info-item">
                                    <FaTags className="resource-detail-info-icon" />
                                    <div>
                                        <span className="resource-detail-info-label">Sous-domaine</span>
                                        <span className="resource-detail-info-value">{resource.sous_domaine.nom}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResourceDetail;