import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    FaArrowLeft, 
    FaDownload, 
    FaEye, 
    FaCalendar, 
    FaUser, 
    FaTags,
    FaFilePdf,
    FaFileVideo,
    FaFileImage,
    FaFileAlt,
    FaBook,
    FaGlobe,
    FaMapMarkerAlt
} from 'react-icons/fa';
import api from './api';
import { mockRessources, simulateApiCall } from './mockData';
import './index.css';

const RessourceDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [ressource, setRessource] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Récupérer les détails de la ressource
    useEffect(() => {
        const fetchRessourceDetails = async () => {
            try {
                setLoading(true);
                setError('');
                
                // Try API first, then mock data
                try {
                    const response = await api.get(`/ressource/${id}/`);
                    console.log('Detail API Response:', response.data);
                    const ressourceData = response.data.data || response.data;
                    setRessource(ressourceData);
                } catch (apiError) {
                    console.log('API not available for details, using mock data');
                    // Find in mock data
                    const mockData = mockRessources.results.data.find(r => r.id.toString() === id);
                    if (mockData) {
                        setRessource(mockData);
                    } else {
                        setError('Ressource non trouvée');
                    }
                }
            } catch (error) {
                console.error('Erreur lors du chargement des détails:', error);
                setError('Erreur lors du chargement des détails');
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchRessourceDetails();
        }
    }, [id]);

    // Fonction pour obtenir l'icône selon le format
    const getFormatIcon = (format) => {
        if (!format) return <FaFileAlt className="text-gray-500" />;
        
        const formatLower = format.toLowerCase();
        if (formatLower === 'pdf') return <FaFilePdf className="text-red-500" />;
        if (['mp4', 'avi', 'mov'].includes(formatLower)) return <FaFileVideo className="text-blue-500" />;
        if (['png', 'jpg', 'jpeg', 'gif'].includes(formatLower)) return <FaFileImage className="text-green-500" />;
        
        return <FaFileAlt className="text-gray-500" />;
    };

    // Fonction pour formater la date
    const formatDate = (dateString) => {
        if (!dateString) return 'Date inconnue';
        return new Date(dateString).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Fonction pour télécharger un fichier
    const handleDownload = (fileUrl, filename) => {
        const fullUrl = fileUrl.startsWith('http') ? fileUrl : `http://localhost:8000${fileUrl}`;
        const link = document.createElement('a');
        link.href = fullUrl;
        link.download = filename || 'fichier';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Fonction pour ouvrir un fichier
    const handleOpenFile = (fileUrl) => {
        const fullUrl = fileUrl.startsWith('http') ? fileUrl : `http://localhost:8000${fileUrl}`;
        window.open(fullUrl, '_blank');
    };

    if (loading) {
        return (
            <div className="loading-page">
                <div className="loading-header">
                    <div className="loading-header-content">
                        <button
                            onClick={() => navigate('/')}
                            className="loading-back-btn"
                        >
                            <FaArrowLeft />
                            Retour aux ressources
                        </button>
                        <div className="loading-title-placeholder"></div>
                    </div>
                </div>
                <div className="loading-content">
                    <div className="loading-content-placeholder"></div>
                </div>
            </div>
        );
    }

    if (error || !ressource) {
        return (
            <div className="error-page">
                <div className="error-header">
                    <div className="error-header-content">
                        <button
                            onClick={() => navigate('/')}
                            className="error-back-btn"
                        >
                            <FaArrowLeft />
                            Retour aux ressources
                        </button>
                    </div>
                </div>
                <div className="error-content">
                    <div className="error-icon">❌</div>
                    <h2 className="error-title">
                        Ressource non trouvée
                    </h2>
                    <p className="error-message">{error}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="error-btn"
                    >
                        Retour aux ressources
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="ressource-details-page">
            {/* En-tête */}
            <div className="ressource-details-header">
                <div className="ressource-details-header-content">
                    <button
                        onClick={() => navigate('/')}
                        className="ressource-details-back-btn"
                    >
                        <FaArrowLeft />
                        Retour aux ressources
                    </button>
                    <h1 className="ressource-details-title">
                        {ressource.titre}
                    </h1>
                    {ressource.sous_titre && (
                        <p className="ressource-details-subtitle">
                            {ressource.sous_titre}
                        </p>
                    )}
                </div>
            </div>

            {/* Contenu principal */}
            <div className="ressource-details-main">
                <div className="ressource-details-grid">
                    {/* Colonne principale */}
                    <div>
                        {/* Image de couverture */}
                        {ressource.couverture && (
                            <div className="ressource-details-cover">
                                <img 
                                    src={ressource.couverture.startsWith('http') ? ressource.couverture : `http://localhost:8000${ressource.couverture}`}
                                    alt={ressource.titre}
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                    }}
                                />
                            </div>
                        )}

                        {/* Description */}
                        {ressource.description && (
                            <div className="ressource-details-description">
                                <h2>Description</h2>
                                <div 
                                    className="ressource-details-description-content"
                                    dangerouslySetInnerHTML={{ __html: ressource.description }}
                                />
                            </div>
                        )}

                        {/* Fichiers associés */}
                        {ressource.fichiers && ressource.fichiers.length > 0 && (
                            <div className="ressource-details-files">
                                <h2>Fichiers disponibles ({ressource.fichiers.length})</h2>
                                <div className="ressource-details-files-grid">
                                    {ressource.fichiers.map((fichier, index) => (
                                        <div key={fichier.id || index} className="file-card">
                                            <div className="file-card-header">
                                                <div className="file-card-content">
                                                    <div className="file-card-icon">
                                                        {getFormatIcon(fichier.format || ressource.format)}
                                                    </div>
                                                    <div className="file-card-details">
                                                        <h3 className="file-card-title">
                                                            {fichier.titre || ressource.titre || `Fichier ${index + 1}`}
                                                        </h3>
                                                        
                                                        <div className="file-card-badges">
                                                            <span className="file-format-badge">
                                                                {(fichier.format || ressource.format)?.toUpperCase()}
                                                            </span>
                                                            {fichier.id && (
                                                                <span className="file-id-badge">
                                                                    ID: {fichier.id}
                                                                </span>
                                                            )}
                                                        </div>
                                                        
                                                        <div className="file-card-info">
                                                            {fichier.duree && (
                                                                <p>Durée: {fichier.duree}</p>
                                                            )}
                                                            {fichier.fichier && (
                                                                <p className="file-card-filename">
                                                                    Fichier: {fichier.fichier.split('/').pop()}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="file-card-actions">
                                                <button
                                                    onClick={() => handleOpenFile(fichier.fichier)}
                                                    className="file-action-btn file-open-btn"
                                                >
                                                    <FaEye />
                                                    Ouvrir
                                                </button>
                                                <button
                                                    onClick={() => handleDownload(fichier.fichier, fichier.titre || ressource.titre)}
                                                    className="file-action-btn file-download-btn"
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

                    {/* Sidebar avec informations */}
                    <div>
                        <div className="ressource-details-sidebar">
                            <div className="sidebar-header">
                                <h3 className="sidebar-title">
                                    Informations détaillées
                                </h3>
                                <span className="sidebar-id-badge">
                                    #{ressource.id}
                                </span>
                            </div>
                            
                            <div className="sidebar-content">
                               
                                {/* Titre */}
                                <div style={{
                                    backgroundColor: 'white',
                                    padding: '1rem',
                                    borderRadius: '0.5rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <FaBook style={{ color: '#2563eb', fontSize: '0.875rem' }} />
                                        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>
                                            Titre
                                        </span>
                                    </div>
                                    <h4 style={{ margin: '0', color: '#111827', fontSize: '0.875rem', fontWeight: '600' }}>
                                        {ressource.titre}
                                    </h4>
                                    {ressource.sous_titre && (
                                        <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.8rem' }}>
                                            {ressource.sous_titre}
                                        </p>
                                    )}
                                </div>

                                {/* Auteurs */}
                                {ressource.auteurs && (
                                    <div style={{
                                        backgroundColor: 'white',
                                        padding: '1rem',
                                        borderRadius: '0.5rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <FaUser style={{ color: '#2563eb', fontSize: '0.875rem' }} />
                                            <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>
                                                Auteur(s)
                                            </span>
                                        </div>
                                        <p style={{ margin: '0', color: '#111827', fontSize: '0.875rem' }}>
                                            {ressource.auteurs}
                                        </p>
                                    </div>
                                )}

                                {/* Domaine */}
                                <div style={{
                                    backgroundColor: 'white',
                                    padding: '1rem',
                                    borderRadius: '0.5rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <FaTags style={{ color: '#2563eb', fontSize: '0.875rem' }} />
                                        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>
                                            Domaine
                                        </span>
                                    </div>
                                    <p style={{ margin: '0', color: '#111827', fontSize: '0.875rem' }}>
                                        {ressource.domaine?.nom || 'Non spécifié'}
                                    </p>
                                    {ressource.sous_domaine?.nom && (
                                        <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.75rem' }}>
                                        {ressource.sous_domaine.nom}
                                        </p>
                                    )}
                                </div>

                                {/* Type et Format */}
                                <div style={{
                                    backgroundColor: 'white',
                                    padding: '1rem',
                                    borderRadius: '0.5rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <FaFileAlt style={{ color: '#2563eb', fontSize: '0.875rem' }} />
                                        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>
                                            Type & Format
                                        </span>
                                    </div>
                                    <p style={{ margin: '0', color: '#111827', fontSize: '0.875rem' }}>
                                        {ressource.type?.charAt(0).toUpperCase() + ressource.type?.slice(1)} • {ressource.format?.toUpperCase()}
                                    </p>
                                </div>

                                {/* Langue */}
                                {ressource.langue && (
                                    <div style={{
                                        backgroundColor: 'white',
                                        padding: '1rem',
                                        borderRadius: '0.5rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <FaGlobe style={{ color: '#2563eb', fontSize: '0.875rem' }} />
                                            <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>
                                                Langue
                                            </span>
                                        </div>
                                        <p style={{ margin: '0', color: '#111827', fontSize: '0.875rem' }}>
                                            {ressource.langue === 'fr' ? 'Français' : ressource.langue === 'en' ? 'Anglais' : ressource.langue.toUpperCase()}
                                        </p>
                                    </div>
                                )}

                                {/* Pays */}
                                {ressource.pays && (
                                    <div style={{
                                        backgroundColor: 'white',
                                        padding: '1rem',
                                        borderRadius: '0.5rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <FaMapMarkerAlt style={{ color: '#2563eb', fontSize: '0.875rem' }} />
                                            <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>
                                                Pays
                                            </span>
                                        </div>
                                        <p style={{ margin: '0', color: '#111827', fontSize: '0.875rem' }}>
                                            {ressource.pays}
                                        </p>
                                    </div>
                                )}

                                {/* Édition et lieu */}
                                {(ressource.edition || ressource.lieu_edition) && (
                                    <div style={{
                                        backgroundColor: 'white',
                                        padding: '1rem',
                                        borderRadius: '0.5rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <FaBook style={{ color: '#2563eb', fontSize: '0.875rem' }} />
                                            <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>
                                                Publication
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            {ressource.edition && (
                                                <p style={{ margin: '0', color: '#111827', fontSize: '0.875rem' }}>
                                                    {ressource.edition} édition
                                                </p>
                                            )}
                                            {ressource.lieu_edition && (
                                                <p style={{ margin: '0', color: '#111827', fontSize: '0.875rem' }}>
                                                    Lieu: {ressource.lieu_edition}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Date de publication */}
                                {ressource.date_publication && (
                                    <div style={{
                                        backgroundColor: 'white',
                                        padding: '1rem',
                                        borderRadius: '0.5rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <FaCalendar style={{ color: '#2563eb', fontSize: '0.875rem' }} />
                                            <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>
                                                Date de publication
                                            </span>
                                        </div>
                                        <p style={{ margin: '0', color: '#111827', fontSize: '0.875rem' }}>
                                            {formatDate(ressource.date_publication)}
                                        </p>
                                    </div>
                                )}

                                {/* ISBN */}
                                {ressource.ISBN && (
                                    <div style={{
                                        backgroundColor: 'white',
                                        padding: '1rem',
                                        borderRadius: '0.5rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>
                                                ISBN
                                            </span>
                                        </div>
                                        <p style={{ 
                                            margin: '0', 
                                            color: '#111827', 
                                            fontSize: '0.875rem', 
                                            fontFamily: 'monospace',
                                            backgroundColor: '#f3f4f6',
                                            padding: '0.5rem',
                                            borderRadius: '0.375rem'
                                        }}>
                                            {ressource.ISBN}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RessourceDetails;