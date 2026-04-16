import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
    FaMapMarkerAlt,
    FaHeart,
    FaMarkdown,
    FaFileCode,
    FaArrowAltCircleDown
} from 'react-icons/fa';
import api, { favorisAPI } from './api';
import { mockRessources, simulateApiCall } from './mockData';
import './index.css';
import { getMediaUrl, getFileUrl } from './config';
import { getSession } from './utils/auth';
import { EpubViewer } from 'react-epub-viewer';

const RessourceDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [ressource, setRessource] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isFavorite, setIsFavorite] = useState(false);
    const [favoriteLoading, setFavoriteLoading] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerType, setViewerType] = useState(null);
    const [viewerUrl, setViewerUrl] = useState('');
    const [viewerTitle, setViewerTitle] = useState('');
    const [viewerLoading, setViewerLoading] = useState(false);
    const [viewerError, setViewerError] = useState('');
    const [viewerObjectUrl, setViewerObjectUrl] = useState('');
    const [viewerEpubHeaders, setViewerEpubHeaders] = useState({});
    const [epubRenderKey, setEpubRenderKey] = useState(0);
    const [epubReady, setEpubReady] = useState(false);
    const epubViewerRef = useRef(null);

    // Récupérer les détails de la ressource depuis le state ou depuis l'API en dernier recours
    useEffect(() => {
        const fetchRessourceDetails = async () => {
            try {
                setLoading(true);
                setError('');
                
                // Essayer d'obtenir la ressource depuis le state passé par la navigation
                if (location.state?.ressource) {
                    // console.log('✅ Ressource trouvée dans le state:', location.state.ressource);
                    setRessource(location.state.ressource);
                    checkFavoriteStatus(location.state.ressource.id);
                    setLoading(false);
                    return;
                }
                
                // Si pas dans le state, essayer l'API (fallback)
                // console.log('🔍 Ressource non trouvée dans le state, tentative API...');
                
                // Use the same API endpoint as HomePage - /ressources/
                try {
                    const response = await api.get('/ressources/');
                    // console.log('Got resources from /ressources/, searching for ID:', id);
                    
                    let ressourceData = null;
                    
                    // Handle the same structure as HomePage
                    if (response.data.results && response.data.results.data && Array.isArray(response.data.results.data)) {
                        ressourceData = response.data.results.data.find(r => r.id.toString() === id);
                    } else if (Array.isArray(response.data.data)) {
                        ressourceData = response.data.data.find(r => r.id.toString() === id);
                    } else if (Array.isArray(response.data)) {
                        ressourceData = response.data.find(r => r.id.toString() === id);
                    }
                    
                    if (ressourceData && ressourceData.id) {
                        // console.log('✅ Ressource found from API:', ressourceData);
                        setRessource(ressourceData);
                        checkFavoriteStatus(ressourceData.id);
                        return;
                    } else {
                        console.warn('Ressource not found in current page, trying to search by type or fetch specific page');
                        // If not found in first page, try other sources
                        throw new Error('Not found in first page');
                    }
                } catch (error) {
                    console.warn('Could not find in /ressources/:', error.message);
                    
                    // Try /ressource/all/ as backup
                    try {
                        // console.log('Trying /ressource/all/ ...');
                        const response = await api.get('/ressource/all/');
                        
                        let ressourceData = null;
                        if (response.data.results && response.data.results.data && Array.isArray(response.data.results.data)) {
                            ressourceData = response.data.results.data.find(r => r.id.toString() === id);
                        } else if (Array.isArray(response.data.data)) {
                            ressourceData = response.data.data.find(r => r.id.toString() === id);
                        } else if (Array.isArray(response.data)) {
                            ressourceData = response.data.find(r => r.id.toString() === id);
                        }
                        
                        if (ressourceData && ressourceData.id) {
                            // console.log('✅ Ressource found in /ressource/all/:', ressourceData);
                            setRessource(ressourceData);
                            checkFavoriteStatus(ressourceData.id);
                            return;
                        }
                    } catch (error2) {
                        console.warn('Could not fetch from /ressource/all/:', error2.message);
                    }
                    
                    // Last resort: Try mock data
                    // console.log('Trying mock data...');
                    let mockData = null;
                    
                    if (mockRessources.results && mockRessources.results.data) {
                        mockData = mockRessources.results.data.find(r => r.id.toString() === id);
                    } else if (Array.isArray(mockRessources)) {
                        mockData = mockRessources.find(r => r.id.toString() === id);
                    }
                    
                    if (mockData) {
                        // console.log('✅ Ressource found in mock data:', mockData);
                        setRessource(mockData);
                        checkFavoriteStatus(mockData.id);
                    } else {
                        console.error('❌ Ressource not found anywhere. ID:', id);
                        setError('Ressource non trouvée');
                    }
                }
            } catch (error) {
                console.error('❌ Erreur lors du chargement des détails:', error);
                setError('Erreur lors du chargement des détails');
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchRessourceDetails();
        }
    }, [id, location.state]);

    // Vérifier le statut des favoris
    const checkFavoriteStatus = async (ressourceId) => {
        try {
            if (!ressourceId) {
                console.warn('No ressource ID provided for favorite check');
                return;
            }
            const isInFavorites = await favorisAPI.checkFavori(ressourceId);
            setIsFavorite(isInFavorites);
        } catch (error) {
            console.warn('Erreur lors de la vérification des favoris:', error);
            // Don't block display on favorite check error
            setIsFavorite(false);
        }
    };

    // Gérer l'ajout/suppression des favoris
    const handleToggleFavorite = async () => {
        if (!ressource) return;
        
        setFavoriteLoading(true);
        try {
            if (isFavorite) {
                // Supprimer des favoris
                await favorisAPI.removeFavori(ressource.id);
                setIsFavorite(false);
                showNotification('Retiré des favoris', 'success');
            } else {
                // Ajouter aux favoris
                await favorisAPI.addFavori(ressource.id);
                setIsFavorite(true);
                showNotification('Ajouté aux favoris', 'success');
            }
        } catch (error) {
            console.error('Erreur lors de la gestion des favoris:', error);
            showNotification(error.message, 'error');
        } finally {
            setFavoriteLoading(false);
        }
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
        
        // Supprimer automatiquement après 3 secondes
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

    // Fonction pour déterminer le type de fichier selon son format
    const getFileTypeFolder = (format) => {
        if (!format) return 'AUTRES';
        
        const formatLower = format.toLowerCase();
        
        // Vidéos
        if (['mp4', 'avi', 'mov', 'mkv', 'flv', 'wmv', 'webm', 'm4v'].includes(formatLower)) {
            return 'VIDEOS';
        }
        
        // Audio
        if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'].includes(formatLower)) {
            return 'AUDIO';
        }
        
        // Livres/Documents
        if (['pdf', 'epub', 'mobi', 'doc', 'docx', 'txt', 'rtf'].includes(formatLower)) {
            return 'LIVRES';
        }
        
        // Images
        if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'tiff'].includes(formatLower)) {
            return 'IMAGES';
        }
        
        return 'AUTRES';
    };

    // Fonction pour enregistrer une consultation
    const recordConsultation = async (ressourceId) => {
        try {
            // console.log('🔄 Enregistrement consultation pour ressource:', ressourceId);
            const response = await api.post('/consultations/', {
                ressource_id: ressourceId
            });
            // console.log('✅ Consultation enregistrée:', response.data);
        } catch (error) {
            console.error('❌ Erreur lors de l\'enregistrement de la consultation:', error.response?.data || error.message);
            // Ne pas bloquer l'action si l'enregistrement échoue
        }
    };

    // Fonction pour enregistrer un téléchargement
    const recordDownload = async (ressourceId) => {
        try {
            // console.log('🔄 Enregistrement téléchargement pour ressource:', ressourceId);
            const response = await api.post('/downloads/', {
                ressource_id: ressourceId
            });
            // console.log('✅ Téléchargement enregistré:', response.data);
        } catch (error) {
            console.error('❌ Erreur lors de l\'enregistrement du téléchargement:', error.response?.data || error.message);
            // Ne pas bloquer l'action si l'enregistrement échoue
        }
    };

    const getFileExtension = (fileUrl, format) => {
        if (format) return format.toLowerCase().trim();
        if (!fileUrl) return '';
        const cleanUrl = fileUrl.split('?')[0];
        const ext = cleanUrl.split('.').pop();
        return (ext || '').toLowerCase().trim();
    };

    const getReadableType = (file, ressource) => {
        const rawFormat = (file?.format || ressource?.format || '').toString().toLowerCase().trim().replace('.', '');
        const rawFilePath = (file?.fichier || '').toString();
        const cleanPath = rawFilePath.split('?')[0].toLowerCase();

        const isPdf =
            rawFormat === 'pdf' ||
            rawFormat === 'application/pdf' ||
            cleanPath.endsWith('.pdf');

        const isEpub =
            rawFormat === 'epub' ||
            rawFormat === 'application/epub+zip' ||
            cleanPath.endsWith('.epub');

        const VIDEO_EXTS = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
        const isVideo =
            VIDEO_EXTS.includes(rawFormat) ||
            VIDEO_EXTS.some(ext => cleanPath.endsWith('.' + ext));

        if (isPdf) return 'pdf';
        if (isEpub) return 'epub';
        if (isVideo) return 'video';
        return null;
    };

    const fetchFileBlobWithAuth = async (fileUrl, mimeType) => {
        try {
            const response = await api.get(fileUrl, { responseType: 'blob' });
            return response.data;
        } catch (axiosError) {
            console.warn('Axios blob fetch failed, fallback to fetch:', axiosError);
            const { token } = getSession();
            const headers = {};
            if (token) {
                const authToken = token.startsWith('Bearer ') || token.startsWith('Token ') ? token : `Bearer ${token}`;
                headers.Authorization = authToken;
            }
            const response = await fetch(fileUrl, { headers });
            if (!response.ok) {
                throw new Error(`File fetch failed: ${response.status}`);
            }
            const buffer = await response.arrayBuffer();
            return new Blob([buffer], { type: mimeType });
        }
    };

    const isLikelyValidEpubBlob = async (blob) => {
        try {
            if (!blob || blob.size < 4) return false;
            const buffer = await blob.slice(0, 4).arrayBuffer();
            const bytes = new Uint8Array(buffer);
            // EPUB is a ZIP container => starts with PK\x03\x04 or PK signatures
            return bytes[0] === 0x50 && bytes[1] === 0x4B;
        } catch (error) {
            console.warn('EPUB blob validation failed:', error);
            return false;
        }
    };

    // Fonction pour ouvrir/consulter un fichier
    const handleOpen = async (file) => {
        try {
            // Enregistrer la consultation
            await recordConsultation(ressource.id);
            const fileUrl = file?.fichier || file;
            const fileTitle = file?.titre || ressource.titre || 'Document';
            const extension = getReadableType(file, ressource) || getFileExtension(fileUrl, file?.format || ressource.format);
            const fullUrl = getFileUrl(fileUrl);

            console.log('📖 handleOpen:', {
                fileUrl,
                detectedType: extension,
                format: file?.format || ressource.format,
                fullUrl
            });

            if (extension === 'video') {
                setViewerType('video');
                setViewerTitle(fileTitle);
                setViewerUrl(fullUrl);
                setViewerError('');
                setViewerLoading(false);
                setViewerOpen(true);
                return;
            }

            if (extension === 'pdf' || extension === 'epub') {
                setViewerType(extension);
                setViewerTitle(fileTitle);
                setViewerUrl('');
                setViewerError('');
                setViewerLoading(extension === 'pdf');
                setEpubReady(false);
                setViewerOpen(true);
                if (viewerObjectUrl) {
                    URL.revokeObjectURL(viewerObjectUrl);
                    setViewerObjectUrl('');
                }

                try {
                    const mimeType = extension === 'pdf' ? 'application/pdf' : 'application/epub+zip';
                    // console.log('📥 Fetching file with auth:', { fullUrl, mimeType, extension });
                    const blob = await fetchFileBlobWithAuth(fullUrl, mimeType);
                    // console.log('✅ Blob received:', { size: blob.size, type: blob.type });

                    if (extension === 'epub') {
                        // console.log('🔍 Validating EPUB blob...');
                        const validEpub = await isLikelyValidEpubBlob(blob);
                        // console.log('EPUB validation result:', validEpub);
                        if (!validEpub) {
                            throw new Error('Invalid EPUB blob content');
                        }
                    }

                    const objectUrl = URL.createObjectURL(blob);
                    // console.log('🔗 Object URL created:', objectUrl);
                    setViewerObjectUrl(objectUrl);
                    setViewerUrl(objectUrl);
                    if (extension === 'epub') {
                        setViewerEpubHeaders({});
                        setEpubRenderKey(prev => prev + 1);
                        // console.log('📚 EPUB viewer initialized with render key');
                        setViewerLoading(false);
                    } else {
                        setViewerLoading(false);
                    }
                } catch (fetchError) {
                    console.warn('❌ File fetch with auth failed:', fetchError);
                    // console.log('🔄 Trying direct URL as fallback for', extension);
                    
                    // Pour les EPUBs aussi, essayer l'URL directe comme fallback
                    setViewerUrl(fullUrl);
                    if (extension === 'epub') {
                        setViewerEpubHeaders({});
                        setEpubRenderKey(prev => prev + 1);
                        // console.log('📚 EPUB viewer initialized with direct URL');
                    }
                    setViewerLoading(false);
                }
                return;
            }

            // Fallback: ouvrir dans un nouvel onglet pour les autres formats
            window.open(fullUrl, '_blank');
        } catch (error) {
            console.error('Erreur lors de l\'ouverture du fichier:', error);
        }
    };

    // Fonction pour télécharger un fichier automatiquement
    const handleDownload = async (fileUrl, filename) => {
        try {
            // Enregistrer le téléchargement
            await recordDownload(ressource.id);
            
            const fullUrl = getFileUrl(fileUrl);
            
            // Déterminer l'extension du fichier
            const fileExtension = filename ? filename.split('.').pop() : fileUrl.split('.').pop();
            
            // Déterminer le dossier de destination selon le type
            const typeFolder = getFileTypeFolder(fileExtension);
            
            // Créer un nom de fichier propre avec préfixe organisé
            const cleanFilename = filename || `ressource_${ressource.id}.${fileExtension}`;
            const organizedName = `BNN_${typeFolder}_${cleanFilename}`;
            
            // Téléchargement automatique sans dialogue
            const link = document.createElement('a');
            link.href = fullUrl;
            link.download = organizedName;
            
            // Empêcher l'ouverture du fichier après téléchargement
            link.target = '_self';
            link.style.display = 'none';
            
            // Ajouter temporairement au DOM et déclencher le téléchargement
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Notification discrète de succès
            setTimeout(() => {
                // Créer une notification toast au lieu d'une alerte
                showDownloadNotification(organizedName, typeFolder);
            }, 500);
            
        } catch (error) {
            console.error('Erreur lors du téléchargement:', error);
            alert('Erreur lors du téléchargement du fichier. Veuillez réessayer.');
        }
    };

    // Fonction pour afficher une notification de téléchargement
    const showDownloadNotification = (filename, folder) => {
        // Créer l'élément de notification
        const notification = document.createElement('div');
        notification.className = 'download-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">✅</span>
                <div class="notification-text">
                    <strong>Téléchargement réussi !</strong>
                    <br>
                    <small>${filename}</small>
                    <br>
                    <small>📁 Organisé pour : ${folder}</small>
                </div>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Ajouter les styles inline si nécessaire
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            z-index: 10000;
            max-width: 300px;
            animation: slideInRight 0.3s ease;
        `;
        
        // Ajouter au DOM
        document.body.appendChild(notification);
        
        // Supprimer automatiquement après 5 secondes
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    };

    // Fonction pour ouvrir un fichier
    const handleOpenFile = (fileUrl) => {
        const fullUrl = getFileUrl(fileUrl);
        window.open(fullUrl, '_blank');
    };

    // Vérifier si l'API File System Access est disponible
    const isFileSystemAccessSupported = () => {
        return 'showDirectoryPicker' in window;
    };


    const closeViewer = () => {
        setViewerOpen(false);
        setViewerType(null);
        setViewerUrl('');
        setViewerTitle('');
        setViewerError('');
        setViewerLoading(false);
        setEpubReady(false);
        setViewerEpubHeaders({});
        if (viewerObjectUrl) {
            URL.revokeObjectURL(viewerObjectUrl);
            setViewerObjectUrl('');
        }
    };

    useEffect(() => {
        if (!viewerOpen || viewerType !== 'epub' || !viewerUrl || epubReady || viewerError) {
            return;
        }

        // console.log('⏱️ EPUB timeout timer started (20s)');
        const timeoutId = setTimeout(() => {
            console.warn('⏰ EPUB loading timeout reached');
            setViewerError('Le fichier EPUB a pris trop de temps à se charger.');
            setViewerLoading(false);
        }, 20000); // Increased from 12s to 20s for larger EPUB files

        return () => {
            // console.log('🧹 EPUB timeout timer cleared');
            clearTimeout(timeoutId);
        };
    }, [viewerOpen, viewerType, viewerUrl, epubReady, viewerError]);


    if (loading) {
        return (
            <div className="loading-page">
                <div className="loading-header">
                    <div className="loading-header-content">
                        <button
                            onClick={() => navigate(-1)}
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
                            onClick={() => navigate(-1)}
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
            {viewerOpen && (
                <div className="viewer-overlay" role="dialog" aria-modal="true">
                    <div className="viewer-modal">
                        <div className="viewer-header">
                            <div className="viewer-title">
                                {viewerTitle}
                                <span className="viewer-type-badge">{viewerType?.toUpperCase()}</span>
                            </div>
                            <div className="viewer-actions">
                                <button className="viewer-close-btn" onClick={closeViewer}>
                                    Fermer
                                </button>
                            </div>
                        </div>
                        <div className="viewer-body">
                            {viewerLoading && (
                                <div className="viewer-loading">Chargement...</div>
                            )}
                            {viewerError && (
                                <div className="viewer-error">{viewerError}</div>
                            )}
                            {!viewerError && viewerType === 'pdf' && (
                                <iframe
                                    className="viewer-iframe"
                                    src={viewerUrl}
                                    title={viewerTitle}
                                />
                            )}
                            {!viewerError && viewerType === 'video' && viewerUrl && (
                                <div className="viewer-video">
                                    <video
                                        key={viewerUrl}
                                        controls
                                        autoPlay
                                        style={{ width: '100%', height: '100%', maxHeight: '100%', background: '#000', outline: 'none' }}
                                    >
                                        <source src={viewerUrl} />
                                        Votre navigateur ne supporte pas la lecture vidéo.
                                    </video>
                                </div>
                            )}
                            {!viewerError && viewerType === 'epub' && viewerUrl && (
                                <div className="viewer-epub">
                                    <div style={{ position: 'relative', height: '100%' }}>
                                    <EpubViewer
                                        key={epubRenderKey}
                                        url={viewerUrl}
                                        ref={epubViewerRef}
                                        epubFileOptions={{ requestHeaders: viewerEpubHeaders }}
                                        style={{ height: '100%' }}
                                        bookChanged={(book) => {
                                            // console.log('📖 EPUB bookChanged event:', book ? 'loaded' : 'null');
                                            setEpubReady(true);
                                            setViewerLoading(false);
                                        }}
                                        renditionChanged={(rendition) => {
                                            // console.log('🎨 EPUB renditionChanged event:', rendition ? 'ready' : 'null');
                                            setEpubReady(true);
                                            setViewerLoading(false);
                                        }}
                                        pageChanged={(page) => {
                                            // console.log('📄 EPUB pageChanged event:', page);
                                            setEpubReady(true);
                                            setViewerLoading(false);
                                        }}
                                        loadingView={<div className="viewer-loading">Chargement EPUB...</div>}
                                    />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* En-tête */}
            <div className="ressource-details-header">
                <div className="ressource-details-header-content">
                    <button
                        onClick={() => navigate(-1)}
                        className="ressource-details-back-btn"
                    >
                        <FaArrowLeft />
                        Retour aux ressources
                    </button>
                    <div className="ressource-details-title-section">
                        <h1 className="ressource-details-title">
                            {ressource.titre}
                        </h1>
                        <button 
                            className={`favorite-btn ${isFavorite ? 'active' : ''} ${favoriteLoading ? 'loading' : ''}`}
                            onClick={handleToggleFavorite}
                            disabled={favoriteLoading}
                            title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                        >
                            <FaHeart />
                            <span className="favorite-btn-text">
                                {favoriteLoading ? 'Chargement...' : (isFavorite ? 'Favoris' : 'Ajouter')}
                            </span>
                        </button>
                    </div>
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
                                    src={getMediaUrl(ressource.couverture)}
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
                                            <span className="file-folder-badge">
                                                📁 {getFileTypeFolder(fichier.format || ressource.format)}
                                            </span>
                                            {fichier.id && (
                                                <span className="file-id-badge">
                                                    ID: {fichier.id}
                                                </span>
                                            )}
                                        </div>                                                        <div className="file-card-info">
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
                                                    onClick={() => handleOpen(fichier)}
                                                    className="file-action-btn file-open-btn"
                                                >
                                                    <FaEye />
                                                    OUVRIR 
                                                </button>

                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{
                            marginTop: '1.5rem',
                            padding: '1rem 1.5rem',
                            backgroundColor: '#fcfcfc',
                            border: '1px solid #dfdedd',
                            borderRadius: '0.5rem',
                            textAlign: 'center',
                            color: '#7a7a7a',
                            fontWeight: '500',
                            fontSize: '0.95rem'
                        }}>
                            <FaArrowAltCircleDown/> Cette plateforme est dédiée à la consultation uniquement.
                        </div>
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