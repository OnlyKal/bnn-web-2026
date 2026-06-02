import { useState, useEffect, useCallback, useRef } from 'react';
import {
    FaSearchPlus,
    FaSearchMinus,
    FaExpand,
    FaCompress,
    FaTimes,
    FaMinus,
    FaWindowMinimize,
    FaWindowMaximize,
    FaExclamationTriangle,
    FaRedo
} from 'react-icons/fa';

const PDFViewer = ({ 
    pdfData,
    title = 'Document PDF',
    onClose,
    isLoading = false
}) => {
    const [scale, setScale] = useState(100);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [viewerSize, setViewerSize] = useState('normal');
    const [pdfUrl, setPdfUrl] = useState(null);
    const [error, setError] = useState(null);
    const [pdfLoaded, setPdfLoaded] = useState(false);
    const [debugInfo, setDebugInfo] = useState(null);
    
    const containerRef = useRef(null);
    const viewerRef = useRef(null);
    const pdfUrlRef = useRef(null);
    const embedRef = useRef(null);
    
    // Créer l'URL du blob au montage
    useEffect(() => {
        console.log('📄 PDFViewer: pdfData changed', { 
            hasData: !!pdfData, 
            type: pdfData ? pdfData.constructor?.name : 'null',
            isBlob: pdfData instanceof Blob,
            size: pdfData instanceof Blob ? pdfData.size : 'N/A'
        });
        
        if (pdfData) {
            try {
                let url;
                let info = {};
                
                if (pdfData instanceof Blob) {
                    console.log('📄 Creating blob URL from Blob', { 
                        size: pdfData.size, 
                        type: pdfData.type 
                    });
                    
                    // Vérifier que le blob a du contenu
                    if (pdfData.size === 0) {
                        throw new Error('Le fichier PDF est vide (0 octets)');
                    }
                    
                    // Vérifier le type MIME
                    if (pdfData.type && !pdfData.type.includes('pdf') && pdfData.type !== 'application/octet-stream') {
                        console.warn('⚠️ Blob type is not PDF:', pdfData.type);
                    }
                    
                    url = URL.createObjectURL(pdfData);
                    info = { source: 'blob', size: pdfData.size, type: pdfData.type };
                    
                } else if (typeof pdfData === 'string') {
                    console.log('📄 Using string URL directly:', pdfData.substring(0, 100));
                    url = pdfData;
                    info = { source: 'string', url: pdfData.substring(0, 50) + '...' };
                    
                } else if (pdfData instanceof ArrayBuffer) {
                    console.log('📄 Creating blob from ArrayBuffer');
                    const blob = new Blob([pdfData], { type: 'application/pdf' });
                    url = URL.createObjectURL(blob);
                    info = { source: 'arraybuffer', size: pdfData.byteLength };
                    
                } else {
                    console.log('📄 Unknown pdfData type, attempting conversion');
                    const blob = new Blob([pdfData], { type: 'application/pdf' });
                    url = URL.createObjectURL(blob);
                    info = { source: 'converted', type: typeof pdfData };
                }
                
                console.log('✅ PDF URL created:', url.substring(0, 50));
                setPdfUrl(url);
                pdfUrlRef.current = url;
                setDebugInfo(info);
                setError(null);
                setPdfLoaded(false);
                
            } catch (err) {
                console.error('❌ PDF URL creation error:', err);
                setError(err.message || 'Erreur lors du chargement du PDF');
                setDebugInfo({ error: err.message });
            }
        } else {
            console.log('📄 No pdfData provided');
            setPdfUrl(null);
            setDebugInfo(null);
        }
        
        return () => {
            if (pdfUrlRef.current && pdfUrlRef.current.startsWith('blob:')) {
                console.log('🧹 Revoking blob URL');
                URL.revokeObjectURL(pdfUrlRef.current);
                pdfUrlRef.current = null;
            }
        };
    }, [pdfData]);
    
    // Bloquer les raccourcis clavier
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            if (e.key === 'Escape') {
                if (isFullscreen) {
                    exitFullscreen();
                } else {
                    onClose?.();
                }
            }
        };
        
        document.addEventListener('keydown', handleKeyDown, true);
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [isFullscreen, onClose]);
    
    // Bloquer le clic droit
    const handleContextMenu = useCallback((e) => {
        e.preventDefault();
        return false;
    }, []);
    
    // Gestionnaire fullscreen
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);
    
    const zoomIn = () => setScale(prev => Math.min(200, prev + 25));
    const zoomOut = () => setScale(prev => Math.max(50, prev - 25));
    const resetZoom = () => setScale(100);
    
    const enterFullscreen = async () => {
        try {
            if (viewerRef.current?.requestFullscreen) {
                await viewerRef.current.requestFullscreen();
            }
        } catch (err) {
            console.error('Fullscreen error:', err);
        }
    };
    
    const exitFullscreen = async () => {
        try {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            }
        } catch (err) {
            console.error('Exit fullscreen error:', err);
        }
    };
    
    const toggleFullscreen = () => {
        if (isFullscreen) {
            exitFullscreen();
        } else {
            enterFullscreen();
        }
    };
    
    const setSize = (size) => {
        if (size === 'fullscreen') {
            enterFullscreen();
        } else {
            if (isFullscreen) exitFullscreen();
            setViewerSize(size);
        }
    };
    
    const getViewerClassName = () => {
        let classes = 'pdf-viewer-modal';
        if (viewerSize === 'minimized') classes += ' pdf-viewer-minimized';
        if (viewerSize === 'enlarged') classes += ' pdf-viewer-enlarged';
        if (isFullscreen) classes += ' pdf-viewer-fullscreen';
        return classes;
    };
    
    const showLoadingState = isLoading || (!pdfData && !pdfUrl && !error);
    
    return (
        <div 
            className="pdf-viewer-overlay"
            onContextMenu={handleContextMenu}
            ref={containerRef}
        >
            <div 
                className={getViewerClassName()}
                ref={viewerRef}
            >
                {/* Header */}
                <div className="pdf-viewer-header">
                    <div className="pdf-viewer-title">
                        <span className="pdf-viewer-title-text">{title}</span>
                        <span className="pdf-viewer-badge">PDF</span>
                    </div>
                    
                    <div className="pdf-viewer-controls">
                        {/* Zoom */}
                        <div className="pdf-viewer-control-group">
                            <button 
                                className="pdf-viewer-btn" 
                                onClick={zoomOut}
                                title="Zoom arrière"
                                disabled={scale <= 50 || showLoadingState}
                            >
                                <FaSearchMinus />
                            </button>
                            <span 
                                className="pdf-viewer-zoom-level" 
                                onClick={resetZoom} 
                                title="Réinitialiser"
                            >
                                {scale}%
                            </span>
                            <button 
                                className="pdf-viewer-btn" 
                                onClick={zoomIn}
                                title="Zoom avant"
                                disabled={scale >= 200 || showLoadingState}
                            >
                                <FaSearchPlus />
                            </button>
                        </div>
                        
                        {/* Taille */}
                        <div className="pdf-viewer-control-group">
                            <button 
                                className={`pdf-viewer-btn ${viewerSize === 'minimized' ? 'active' : ''}`}
                                onClick={() => setSize('minimized')}
                                title="Minimiser"
                            >
                                <FaWindowMinimize />
                            </button>
                            <button 
                                className={`pdf-viewer-btn ${viewerSize === 'normal' ? 'active' : ''}`}
                                onClick={() => setSize('normal')}
                                title="Normal"
                            >
                                <FaMinus style={{ transform: 'rotate(90deg)' }} />
                            </button>
                            <button 
                                className={`pdf-viewer-btn ${viewerSize === 'enlarged' ? 'active' : ''}`}
                                onClick={() => setSize('enlarged')}
                                title="Agrandir"
                            >
                                <FaWindowMaximize />
                            </button>
                            <button 
                                className={`pdf-viewer-btn ${isFullscreen ? 'active' : ''}`}
                                onClick={toggleFullscreen}
                                title={isFullscreen ? "Quitter plein écran" : "Plein écran"}
                            >
                                {isFullscreen ? <FaCompress /> : <FaExpand />}
                            </button>
                        </div>
                        
                        {/* Fermer */}
                        <button 
                            className="pdf-viewer-btn pdf-viewer-close-btn" 
                            onClick={onClose}
                            title="Fermer"
                        >
                            <FaTimes />
                        </button>
                    </div>
                </div>
                
                {/* Corps */}
                <div className="pdf-viewer-body">
                    {showLoadingState && (
                        <div className="pdf-viewer-loading">
                            <div className="pdf-viewer-spinner"></div>
                            <span>Chargement du document...</span>
                            {debugInfo && (
                                <small style={{ marginTop: '10px', opacity: 0.7, display: 'block' }}>
                                    Source: {debugInfo.source || 'N/A'}
                                </small>
                            )}
                        </div>
                    )}
                    
                    {error && (
                        <div className="pdf-viewer-error" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <FaExclamationTriangle style={{ fontSize: '2rem', marginBottom: '1rem', color: '#f59e0b' }} />
                            <span style={{ marginBottom: '1rem' }}>{error}</span>
                            {debugInfo && (
                                <small style={{ opacity: 0.7, marginBottom: '1rem', fontSize: '0.75rem' }}>
                                    Debug: {JSON.stringify(debugInfo)}
                                </small>
                            )}
                            <button 
                                className="pdf-viewer-btn"
                                onClick={() => window.location.reload()}
                                style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
                            >
                                <FaRedo style={{ marginRight: '0.5rem' }} />
                                Recharger la page
                            </button>
                        </div>
                    )}
                    
                    {pdfUrl && !isLoading && !error && (
                        <div 
                            className="pdf-viewer-document-container"
                            style={{ 
                                width: '100%',
                                height: '100%',
                                overflow: 'auto',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'flex-start',
                                backgroundColor: '#525659'
                            }}
                        >
                            {/* Utilisation d'iframe pour une meilleure compatibilité */}
                            <iframe
                                ref={embedRef}
                                src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                                title={title}
                                style={{
                                    width: `${scale}%`,
                                    height: '100%',
                                    minHeight: '100%',
                                    border: 'none',
                                    backgroundColor: 'white'
                                }}
                                onLoad={() => {
                                    console.log('✅ PDF iframe loaded successfully');
                                    setPdfLoaded(true);
                                }}
                                onError={(e) => {
                                    console.error('❌ PDF iframe error:', e);
                                    setError('Erreur lors de l\'affichage du PDF');
                                }}
                            />
                        </div>
                    )}
                    
                    {/* Indicateur de débogage en développement */}
                    {debugInfo && pdfUrl && !showLoadingState && (
                        <div style={{
                            position: 'absolute',
                            bottom: '10px',
                            left: '10px',
                            background: 'rgba(0,0,0,0.7)',
                            color: '#0f0',
                            padding: '5px 10px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            zIndex: 100
                        }}>
                            {debugInfo.size ? `${(debugInfo.size / 1024).toFixed(1)} KB` : ''} | {debugInfo.type || 'N/A'} | {pdfLoaded ? '✓ Loaded' : '... Loading'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PDFViewer;
