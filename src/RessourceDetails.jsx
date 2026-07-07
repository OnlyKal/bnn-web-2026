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
import PDFViewer from './components/PDFViewer';
import EPUBViewer from './components/EPUBViewer';
import VideoViewer from './components/VideoViewer';
import AppNavigation from './components/AppNavigation';
import { addLocalHistoryItem } from './utils/localHistory';

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
    const [pdfBlob, setPdfBlob] = useState(null); // Pour le nouveau viewer PDF
    const [epubBlob, setEpubBlob] = useState(null); // Pour le nouveau viewer EPUB - BLOB direct
    const [fileSizes, setFileSizes] = useState({});
    const epubViewerRef = useRef(null);

    // Formater la taille en unités lisibles
    const formatFileSize = (bytes) => {
        if (!bytes || bytes <= 0) return null;
        const units = ['o', 'Ko', 'Mo', 'Go'];
        let i = 0;
        let size = bytes;
        while (size >= 1024 && i < units.length - 1) {
            size /= 1024;
            i++;
        }
        return `${size.toFixed(size < 10 ? 2 : 1)} ${units[i]}`;
    };

    // Calculer la taille des fichiers en les téléchargeant (même approche que le viewer)
    useEffect(() => {
        if (!ressource?.fichiers?.length) return;
        let cancelled = false;
        const { token } = getSession();

        const loadSizes = async () => {
            for (let i = 0; i < ressource.fichiers.length; i++) {
                if (cancelled) return;
                const fichier = ressource.fichiers[i];
                if (!fichier.fichier) continue;
                const url = getFileUrl(fichier.fichier);
                try {
                    const headers = { 'Accept': '*/*' };
                    if (token) {
                        headers.Authorization = token.startsWith('Bearer ') || token.startsWith('Token ') ? token : `Bearer ${token}`;
                    }
                    const response = await fetch(url, { method: 'GET', headers, credentials: 'include' });
                    if (!response.ok) continue;
                    const blob = await response.blob();
                    if (!cancelled && blob.size > 0) {
                        setFileSizes(prev => ({ ...prev, [i]: blob.size }));
                    }
                } catch (_) {}
            }
        };
        loadSizes();

        return () => { cancelled = true; };
    }, [ressource]);

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

    useEffect(() => {
        if (!ressource?.id) return;

        addLocalHistoryItem({
            type: 'resource',
            title: ressource.titre || 'Ressource consultée',
            description: ressource.domaine?.nom || ressource.type || 'Page de détail ouverte',
            url: `/ressources/${ressource.id}`,
            icon: 'resource',
            metadata: { resourceId: ressource.id }
        });
    }, [ressource?.id]);

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
                window.dispatchEvent(new Event('favorites:changed'));
                addLocalHistoryItem({
                    type: 'favorite',
                    title: ressource.titre || 'Favori retiré',
                    description: 'Ressource retirée des favoris',
                    url: `/ressources/${ressource.id}`,
                    icon: 'favorite',
                    metadata: { resourceId: ressource.id, action: 'removed' }
                });
                showNotification('Retiré des favoris', 'success');
            } else {
                // Ajouter aux favoris
                await favorisAPI.addFavori(ressource.id);
                setIsFavorite(true);
                window.dispatchEvent(new Event('favorites:changed'));
                addLocalHistoryItem({
                    type: 'favorite',
                    title: ressource.titre || 'Favori ajouté',
                    description: 'Ressource ajoutée aux favoris',
                    url: `/ressources/${ressource.id}`,
                    icon: 'favorite',
                    metadata: { resourceId: ressource.id, action: 'added' }
                });
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
        if (!format) return <FaFileAlt style={{ color: '#6b7280' }} />;
        
        const formatLower = format.toLowerCase();
        if (formatLower === 'pdf') return <FaFilePdf style={{ color: '#ef4444' }} />;
        if (['mp4', 'avi', 'mov'].includes(formatLower)) return <FaFileVideo style={{ color: '#3b82f6' }} />;
        if (['png', 'jpg', 'jpeg', 'gif'].includes(formatLower)) return <FaFileImage style={{ color: '#22c55e' }} />;
        
        return <FaFileAlt style={{ color: '#6b7280' }} />;
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
        console.log('🔄 Fetching file blob:', { fileUrl, mimeType });
        
        // Utiliser fetch directement pour les fichiers média (évite les problèmes de baseURL axios)
        const { token } = getSession();
        const headers = {
            'Accept': mimeType || '*/*'
        };
        
        if (token) {
            const authToken = token.startsWith('Bearer ') || token.startsWith('Token ') ? token : `Bearer ${token}`;
            headers.Authorization = authToken;
        }
        
        try {
            console.log('📡 Fetching with headers:', Object.keys(headers));
            const response = await fetch(fileUrl, { 
                method: 'GET',
                headers,
                credentials: 'include' // Inclure les cookies si nécessaires
            });
            
            console.log('📥 Response status:', response.status, response.statusText);
            console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                throw new Error(`File fetch failed: ${response.status} ${response.statusText}`);
            }
            
            const blob = await response.blob();
            console.log('✅ Blob received:', { 
                size: blob.size, 
                type: blob.type,
                expectedType: mimeType 
            });
            
            // Si le type MIME du blob n'est pas correct, on le recrée avec le bon type
            if (blob.type !== mimeType && mimeType) {
                console.log('🔧 Recreating blob with correct MIME type');
                return new Blob([blob], { type: mimeType });
            }
            
            return blob;
        } catch (error) {
            console.error('❌ Fetch error:', error);
            
            // Fallback: essayer sans authentification (fichiers publics)
            try {
                console.log('🔄 Trying fallback without auth...');
                const fallbackResponse = await fetch(fileUrl);
                if (!fallbackResponse.ok) {
                    throw new Error(`Fallback fetch failed: ${fallbackResponse.status}`);
                }
                const blob = await fallbackResponse.blob();
                console.log('✅ Fallback blob received:', { size: blob.size, type: blob.type });
                
                if (blob.type !== mimeType && mimeType) {
                    return new Blob([blob], { type: mimeType });
                }
                return blob;
            } catch (fallbackError) {
                console.error('❌ Fallback also failed:', fallbackError);
                throw error;
            }
        }
    };

    const isLikelyValidEpubBlob = async (blob) => {
        try {
            if (!blob) {
                console.warn('📚 EPUB validation: blob is null/undefined');
                return false;
            }
            if (blob.size < 100) { // Un EPUB valide fait au moins quelques centaines d'octets
                console.warn('📚 EPUB validation: blob too small:', blob.size, 'bytes');
                return false;
            }
            
            const buffer = await blob.slice(0, 4).arrayBuffer();
            const bytes = new Uint8Array(buffer);
            
            // EPUB is a ZIP container => starts with PK\x03\x04 (PK magic bytes)
            const isZip = bytes[0] === 0x50 && bytes[1] === 0x4B;
            const signature = bytes.slice(0, 4).join(',');
            
            console.log('📚 EPUB validation:', {
                size: blob.size,
                type: blob.type,
                signature: signature,
                isZipSignature: isZip,
                hex: Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ')
            });
            
            return isZip;
        } catch (error) {
            console.warn('📚 EPUB blob validation error:', error);
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

            if (extension === 'pdf') {
                // Nouveau viewer PDF sécurisé
                setViewerType('pdf');
                setViewerTitle(fileTitle);
                setViewerLoading(true);
                setViewerError('');
                setPdfBlob(null);
                setViewerOpen(true);

                try {
                    console.log('📄 Attempting to fetch PDF blob from:', fullUrl);
                    const blob = await fetchFileBlobWithAuth(fullUrl, 'application/pdf');
                    
                    // Vérifier que le blob est valide (pas vide et signature PDF)
                    if (blob.size === 0) {
                        throw new Error('PDF blob is empty');
                    }
                    
                    // Vérifier la signature PDF (%PDF-)
                    const header = await blob.slice(0, 5).text();
                    if (!header.startsWith('%PDF-')) {
                        console.warn('⚠️ File does not have PDF signature, received:', header);
                        // Continuer quand même, le serveur pourrait renvoyer un type différent
                    }
                    
                    console.log('✅ PDF Blob received:', { 
                        size: blob.size, 
                        type: blob.type,
                        header: header.substring(0, 10)
                    });
                    setPdfBlob(blob);
                    setViewerLoading(false);
                } catch (fetchError) {
                    console.warn('❌ PDF fetch with auth failed:', fetchError.message);
                    
                    // Fallback 1: Essayer sans authentification
                    try {
                        console.log('🔄 Trying fallback fetch without auth...');
                        const response = await fetch(fullUrl, {
                            method: 'GET',
                            credentials: 'omit' // Pas de cookies
                        });
                        
                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                        
                        const blob = await response.blob();
                        console.log('✅ Fallback blob received:', { size: blob.size, type: blob.type });
                        
                        if (blob.size === 0) {
                            throw new Error('Fallback blob is empty');
                        }
                        
                        setPdfBlob(blob);
                        setViewerLoading(false);
                    } catch (fallbackError) {
                        console.error('❌ PDF fallback also failed:', fallbackError.message);
                        
                        // Fallback 2: Utiliser l'URL directe sans blob (moins sécurisé mais fonctionnel)
                        console.log('🔄 Using direct URL fallback...');
                        setPdfBlob(fullUrl); // Le viewer peut accepter une URL string
                        setViewerLoading(false);
                    }
                }
                return;
            }

            if (extension === 'epub') {
                console.log('📚 Opening EPUB viewer...');
                
                setViewerType('epub');
                setViewerTitle(fileTitle);
                setViewerUrl('');
                setViewerError('');
                setViewerLoading(true);
                setEpubReady(false);
                setEpubBlob(null);
                setViewerOpen(true);
                
                if (viewerObjectUrl) {
                    URL.revokeObjectURL(viewerObjectUrl);
                    setViewerObjectUrl('');
                }

                // Construire URL proxy: /media/... au lieu de https://admin.cgiibnn-esursi.cd/media/...
                let proxyUrl = fullUrl;
                try {
                    const urlObj = new URL(fullUrl);
                    // Si l'URL pointe vers le serveur admin, utiliser le chemin relatif (passe par le proxy Vite)
                    if (urlObj.pathname.startsWith('/media/')) {
                        proxyUrl = urlObj.pathname; // ex: /media/ressources/BNN183219.epub
                    }
                } catch (e) {
                    // Si fullUrl est deja un chemin relatif, l'utiliser tel quel
                    if (fullUrl.startsWith('/media/')) {
                        proxyUrl = fullUrl;
                    }
                }
                console.log('📡 EPUB fetch URL (proxy):', proxyUrl, '(original:', fullUrl, ')');

                try {
                    // Methode 1: Fetch via proxy Vite (evite CORS)
                    const { token } = getSession();
                    const headers = { 'Accept': 'application/epub+zip, application/octet-stream, */*' };
                    if (token) {
                        headers.Authorization = token.startsWith('Bearer ') || token.startsWith('Token ') ? token : 'Bearer ' + token;
                    }
                    
                    console.log('📡 Fetching EPUB via proxy...');
                    const response = await fetch(proxyUrl, { method: 'GET', headers });
                    
                    console.log('📥 EPUB response:', response.status, response.statusText, 'type:', response.headers.get('content-type'));
                    
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                    }
                    
                    const blob = await response.blob();
                    console.log('📥 EPUB blob:', blob.size, 'bytes, type:', blob.type);

                    if (blob.size === 0) {
                        throw new Error('EPUB blob is empty (0 bytes)');
                    }

                    // Verifier la signature ZIP (PK)
                    const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
                    console.log('📥 EPUB signature:', header[0].toString(16), header[1].toString(16));
                    
                    if (header[0] !== 0x50 || header[1] !== 0x4B) {
                        const textPreview = await blob.slice(0, 200).text();
                        console.warn('⚠️ Not a ZIP file, content preview:', textPreview);
                        throw new Error('Le fichier telecharge n\'est pas un EPUB valide');
                    }

                    setEpubBlob(blob);
                    setViewerLoading(false);
                    
                } catch (fetchError) {
                    console.error('❌ EPUB proxy fetch failed:', fetchError.message);
                    
                    // Fallback: essayer l'URL directe sans auth
                    try {
                        console.log('🔄 Trying direct URL fallback:', fullUrl);
                        const response = await fetch(fullUrl, { mode: 'cors' });
                        
                        if (!response.ok) {
                            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                        }
                        
                        const blob = await response.blob();
                        console.log('📥 EPUB fallback blob:', blob.size, 'bytes');
                        
                        if (blob.size === 0) {
                            throw new Error('Fallback blob is empty');
                        }

                        setEpubBlob(blob);
                        setViewerLoading(false);
                        
                    } catch (fallbackError) {
                        console.error('❌ EPUB fallback also failed:', fallbackError.message);
                        setViewerError('Impossible de charger le fichier EPUB: ' + fetchError.message);
                        setViewerLoading(false);
                    }
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
        setPdfBlob(null); // Nettoyer le blob PDF
        if (viewerObjectUrl) {
            URL.revokeObjectURL(viewerObjectUrl);
            setViewerObjectUrl('');
        }
    };

    // Le blocage des raccourcis clavier et du clic droit est géré par le composant PDFViewer

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
                <AppNavigation />
                <div className="loading-content">
                    <div className="loading-content-placeholder"></div>
                </div>
            </div>
        );
    }

    if (error || !ressource) {
        return (
            <div className="error-page">
                <AppNavigation />
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
            <AppNavigation />
            {/* Nouveau viewer PDF sécurisé */}
            {viewerOpen && viewerType === 'pdf' && (
                <PDFViewer
                    pdfData={pdfBlob}
                    title={viewerTitle}
                    onClose={closeViewer}
                    isLoading={viewerLoading}
                />
            )}
            
            {/* Nouveau viewer EPUB sécurisé */}
            {viewerOpen && viewerType === 'epub' && (
                <EPUBViewer
                    epubData={epubBlob}
                    title={viewerTitle}
                    onClose={closeViewer}
                    isLoading={viewerLoading}
                />
            )}
            
            {/* Viewer pour vidéo */}
            {viewerOpen && viewerType === 'video' && (
                <VideoViewer
                    videoUrl={viewerUrl}
                    title={viewerTitle}
                    onClose={closeViewer}
                    isLoading={viewerLoading}
                />
            )}
            {/* Contenu principal */}
            <div className="ressource-details-main">
                <div className="ressource-details-title-panel">
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
                                            {(fileSizes[index] != null || fichier.taille) && (
                                                <span className="file-size-badge">
                                                    💾 {fileSizes[index] != null 
                                                        ? formatFileSize(fileSizes[index]) 
                                                        : fichier.taille}
                                                </span>
                                            )}
                                            {fichier.id && (
                                                <span className="file-id-badge">
                                                    ID: {fichier.id}
                                                </span>
                                            )}
                                        </div>                                                        <div className="file-card-info">
                                                            {fichier.duree && ((fichier.format?.toLowerCase() === 'mp4') || (!fichier.format && fichier.fichier?.toLowerCase().endsWith('.mp4'))) && (
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
                            marginTop: '1rem',
                            padding: '0.65rem 1rem',
                            backgroundColor: '#fcfcfc',
                            border: '1px solid #dfdedd',
                            borderRadius: '0.35rem',
                            textAlign: 'center',
                            color: '#7a7a7a',
                            fontWeight: '500',
                            fontSize: '0.7rem'
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
                                    padding: '0.5rem',
                                    borderRadius: '0.3rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                                        <FaBook style={{ color: '#2563eb', fontSize: '0.65rem' }} />
                                        <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#6b7280' }}>
                                            Titre
                                        </span>
                                    </div>
                                    <h4 style={{ margin: '0', color: '#111827', fontSize: '0.7rem', fontWeight: '600' }}>
                                        {ressource.titre}
                                    </h4>
                                    {ressource.sous_titre && (
                                        <p style={{ margin: '0.15rem 0 0 0', color: '#6b7280', fontSize: '0.6rem' }}>
                                            {ressource.sous_titre}
                                        </p>
                                    )}
                                </div>

                                {/* Auteurs */}
                                {ressource.auteurs && (
                                    <div style={{
                                        backgroundColor: 'white',
                                        padding: '0.5rem',
                                        borderRadius: '0.3rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                                            <FaUser style={{ color: '#2563eb', fontSize: '0.65rem' }} />
                                            <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#6b7280' }}>
                                                Auteur(s)
                                            </span>
                                        </div>
                                        <p style={{ margin: '0', color: '#111827', fontSize: '0.7rem' }}>
                                            {ressource.auteurs}
                                        </p>
                                    </div>
                                )}

                                {/* Domaine */}
                                <div style={{
                                    backgroundColor: 'white',
                                    padding: '0.5rem',
                                    borderRadius: '0.3rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                                        <FaTags style={{ color: '#2563eb', fontSize: '0.65rem' }} />
                                        <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#6b7280' }}>
                                            Domaine
                                        </span>
                                    </div>
                                    <p style={{ margin: '0', color: '#111827', fontSize: '0.7rem' }}>
                                        {ressource.domaine?.nom || 'Non spécifié'}
                                    </p>
                                    {ressource.sous_domaine?.nom && (
                                        <p style={{ margin: '0.15rem 0 0 0', color: '#6b7280', fontSize: '0.6rem' }}>
                                        {ressource.sous_domaine.nom}
                                        </p>
                                    )}
                                </div>

                                {/* Type et Format */}
                                <div style={{
                                    backgroundColor: 'white',
                                    padding: '0.5rem',
                                    borderRadius: '0.3rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                                        <FaFileAlt style={{ color: '#2563eb', fontSize: '0.65rem' }} />
                                        <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#6b7280' }}>
                                            Type & Format
                                        </span>
                                    </div>
                                    <p style={{ margin: '0', color: '#111827', fontSize: '0.7rem' }}>
                                        {ressource.type?.charAt(0).toUpperCase() + ressource.type?.slice(1)} • {ressource.format?.toUpperCase()}
                                    </p>
                                </div>

                                {/* Langue */}
                                {ressource.langue && (
                                    <div style={{
                                        backgroundColor: 'white',
                                        padding: '0.5rem',
                                        borderRadius: '0.3rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                                            <FaGlobe style={{ color: '#2563eb', fontSize: '0.65rem' }} />
                                            <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#6b7280' }}>
                                                Langue
                                            </span>
                                        </div>
                                        <p style={{ margin: '0', color: '#111827', fontSize: '0.7rem' }}>
                                            {ressource.langue === 'fr' ? 'Français' : ressource.langue === 'en' ? 'Anglais' : ressource.langue.toUpperCase()}
                                        </p>
                                    </div>
                                )}

                                {/* Pays */}
                                {ressource.pays && (
                                    <div style={{
                                        backgroundColor: 'white',
                                        padding: '0.5rem',
                                        borderRadius: '0.3rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                                            <FaMapMarkerAlt style={{ color: '#2563eb', fontSize: '0.65rem' }} />
                                            <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#6b7280' }}>
                                                Pays
                                            </span>
                                        </div>
                                        <p style={{ margin: '0', color: '#111827', fontSize: '0.7rem' }}>
                                            {ressource.pays}
                                        </p>
                                    </div>
                                )}

                                {/* Édition et lieu */}
                                {(ressource.edition || ressource.lieu_edition) && (
                                    <div style={{
                                        backgroundColor: 'white',
                                        padding: '0.5rem',
                                        borderRadius: '0.3rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                                            <FaBook style={{ color: '#2563eb', fontSize: '0.65rem' }} />
                                            <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#6b7280' }}>
                                                Publication
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                            {ressource.edition && (
                                                <p style={{ margin: '0', color: '#111827', fontSize: '0.7rem' }}>
                                                    {ressource.edition} édition
                                                </p>
                                            )}
                                            {ressource.lieu_edition && (
                                                <p style={{ margin: '0', color: '#111827', fontSize: '0.7rem' }}>
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
                                        padding: '0.5rem',
                                        borderRadius: '0.3rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                                            <FaCalendar style={{ color: '#2563eb', fontSize: '0.65rem' }} />
                                            <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#6b7280' }}>
                                                Date de publication
                                            </span>
                                        </div>
                                        <p style={{ margin: '0', color: '#111827', fontSize: '0.7rem' }}>
                                            {formatDate(ressource.date_publication)}
                                        </p>
                                    </div>
                                )}

                                {/* ISBN */}
                                {ressource.ISBN && (
                                    <div style={{
                                        backgroundColor: 'white',
                                        padding: '0.5rem',
                                        borderRadius: '0.3rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#6b7280' }}>
                                                ISBN
                                            </span>
                                        </div>
                                        <p style={{ 
                                            margin: '0', 
                                            color: '#111827', 
                                            fontSize: '0.65rem', 
                                            fontFamily: 'monospace',
                                            backgroundColor: '#f3f4f6',
                                            padding: '0.35rem',
                                            borderRadius: '0.25rem'
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
