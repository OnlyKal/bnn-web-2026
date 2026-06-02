import { useState, useEffect, useCallback, useRef } from 'react';
import {
    FaTimes,
    FaMinus,
    FaWindowMinimize,
    FaWindowMaximize,
    FaExpand,
    FaCompress,
    FaExclamationTriangle,
    FaFileVideo
} from 'react-icons/fa';

const VideoViewer = ({
    videoUrl,
    title = 'Vidéo',
    onClose,
    isLoading = false
}) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [viewerSize, setViewerSize] = useState('normal');
    const [error, setError] = useState(null);
    const [videoLoaded, setVideoLoaded] = useState(false);

    const viewerRef = useRef(null);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
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

    // Fullscreen change listener
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

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

    const handleContextMenu = useCallback((e) => {
        e.preventDefault();
        return false;
    }, []);

    const showLoadingState = isLoading || (!videoUrl && !error);

    return (
        <div
            className="pdf-viewer-overlay"
            onContextMenu={handleContextMenu}
        >
            <div
                className={getViewerClassName()}
                ref={viewerRef}
            >
                {/* Header */}
                <div className="pdf-viewer-header">
                    <div className="pdf-viewer-title">
                        <FaFileVideo style={{ marginRight: 8 }} />
                        <span className="pdf-viewer-title-text">{title}</span>
                        <span className="pdf-viewer-badge" style={{ backgroundColor: '#8b5cf6' }}>VIDEO</span>
                    </div>

                    <div className="pdf-viewer-controls">
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
                            <span>Chargement de la vidéo...</span>
                        </div>
                    )}

                    {error && (
                        <div className="pdf-viewer-error" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <FaExclamationTriangle style={{ fontSize: '2rem', marginBottom: '1rem', color: '#f59e0b' }} />
                            <span style={{ marginBottom: '1rem' }}>{error}</span>
                        </div>
                    )}

                    {videoUrl && !isLoading && !error && (
                        <div
                            style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                backgroundColor: '#000',
                                overflow: 'hidden'
                            }}
                        >
                            <video
                                key={videoUrl}
                                controls
                                autoPlay
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    maxHeight: '100%',
                                    background: '#000',
                                    outline: 'none'
                                }}
                                onLoadedData={() => setVideoLoaded(true)}
                                onError={() => setError('Impossible de lire cette vidéo.')}
                            >
                                <source src={videoUrl} />
                                Votre navigateur ne supporte pas la lecture vidéo.
                            </video>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoViewer;
