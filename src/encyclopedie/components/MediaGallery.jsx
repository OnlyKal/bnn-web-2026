import React, { useCallback, useEffect, useState } from 'react';
import { LuChevronLeft, LuChevronRight, LuDownload, LuExternalLink, LuFileText, LuHeadphones, LuX } from 'react-icons/lu';
import { isVideoFile, mediaUrl, videoEmbedUrl } from '../rdcUtils';

const VISUAL_TYPES = new Set(['image', 'carte', 'infographie']);

const Lightbox = ({ items, index, onClose, onMove }) => {
    const item = items[index];

    useEffect(() => {
        const onKey = (event) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'ArrowRight') onMove(1);
            if (event.key === 'ArrowLeft') onMove(-1);
        };
        document.addEventListener('keydown', onKey);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = overflow;
        };
    }, [onClose, onMove]);

    return (
        <div className="rdc-lightbox" role="dialog" aria-modal="true" aria-label={item.titre || 'Image'} onClick={onClose}>
            <button type="button" className="rdc-lightbox-close" onClick={onClose} aria-label="Fermer"><LuX size={22} /></button>
            {items.length > 1 && (
                <>
                    <button type="button" className="rdc-lightbox-nav prev" onClick={(e) => { e.stopPropagation(); onMove(-1); }} aria-label="Image précédente">
                        <LuChevronLeft size={28} />
                    </button>
                    <button type="button" className="rdc-lightbox-nav next" onClick={(e) => { e.stopPropagation(); onMove(1); }} aria-label="Image suivante">
                        <LuChevronRight size={28} />
                    </button>
                </>
            )}
            <figure onClick={(e) => e.stopPropagation()}>
                <img src={mediaUrl(item.url)} alt={item.titre || item.legende || ''} />
                <figcaption>
                    {item.titre && <strong>{item.titre}</strong>}
                    {item.legende && <span>{item.legende}</span>}
                    {item.credit && <small>© {item.credit}</small>}
                    <small className="rdc-lightbox-count">{index + 1} / {items.length}</small>
                </figcaption>
            </figure>
        </div>
    );
};

const VideoItem = ({ media }) => {
    const url = mediaUrl(media.url);
    const embed = videoEmbedUrl(media.url);
    return (
        <figure className="rdc-video">
            <div className="rdc-video-frame">
                {embed ? (
                    <iframe
                        src={embed}
                        title={media.titre || 'Vidéo'}
                        loading="lazy"
                        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                    />
                ) : isVideoFile(url) || media.url?.startsWith('/media/') ? (
                    <video controls preload="none" poster={mediaUrl(media.vignette) || undefined}>
                        <source src={url} />
                        Votre navigateur ne peut pas lire cette vidéo.
                    </video>
                ) : (
                    <a className="rdc-video-link" href={url} target="_blank" rel="noopener noreferrer">
                        <LuExternalLink size={22} /> Ouvrir la vidéo
                    </a>
                )}
            </div>
            {(media.titre || media.legende || media.credit) && (
                <figcaption>
                    {media.titre && <strong>{media.titre}</strong>}
                    {media.legende && <span>{media.legende}</span>}
                    {media.credit && <small>© {media.credit}</small>}
                </figcaption>
            )}
        </figure>
    );
};

/** Galerie d'une fiche ou d'une province : visuels, vidéos, audio et documents. */
const MediaGallery = ({ medias = [] }) => {
    const visuals = medias.filter((m) => VISUAL_TYPES.has(m.type) && m.url);
    const videos = medias.filter((m) => m.type === 'video' && m.url);
    const audios = medias.filter((m) => m.type === 'audio' && m.url);
    const documents = medias.filter((m) => m.type === 'document' && m.url);
    const [openIndex, setOpenIndex] = useState(null);

    const close = useCallback(() => setOpenIndex(null), []);
    const move = useCallback((step) => {
        setOpenIndex((index) => (index === null ? null : (index + step + visuals.length) % visuals.length));
    }, [visuals.length]);

    if (medias.length === 0) return null;

    return (
        <div className="rdc-gallery">
            {visuals.length > 0 && (
                <section aria-labelledby="rdc-gallery-images">
                    <h3 id="rdc-gallery-images" className="rdc-subheading">Photographies, cartes et infographies</h3>
                    <div className="rdc-gallery-grid">
                        {visuals.map((media, index) => (
                            <button key={media.id} type="button" className="rdc-gallery-item" onClick={() => setOpenIndex(index)}>
                                <img src={mediaUrl(media.vignette || media.url)} alt={media.titre || media.legende || ''} loading="lazy" decoding="async" />
                                <span className="rdc-gallery-type">{media.type_label}</span>
                                {media.titre && <span className="rdc-gallery-caption">{media.titre}</span>}
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {videos.length > 0 && (
                <section aria-labelledby="rdc-gallery-videos">
                    <h3 id="rdc-gallery-videos" className="rdc-subheading">Vidéos</h3>
                    <div className="rdc-video-grid">
                        {videos.map((media) => <VideoItem key={media.id} media={media} />)}
                    </div>
                </section>
            )}

            {audios.length > 0 && (
                <section aria-labelledby="rdc-gallery-audio">
                    <h3 id="rdc-gallery-audio" className="rdc-subheading">Enregistrements audio</h3>
                    <ul className="rdc-doc-list">
                        {audios.map((media) => (
                            <li key={media.id} className="rdc-doc rdc-doc-audio">
                                <LuHeadphones size={20} aria-hidden="true" />
                                <div>
                                    <strong>{media.titre || 'Enregistrement'}</strong>
                                    {media.legende && <span>{media.legende}</span>}
                                    <audio controls preload="none" src={mediaUrl(media.url)} />
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {documents.length > 0 && (
                <section aria-labelledby="rdc-gallery-docs">
                    <h3 id="rdc-gallery-docs" className="rdc-subheading">Documents complémentaires</h3>
                    <ul className="rdc-doc-list">
                        {documents.map((media) => (
                            <li key={media.id} className="rdc-doc">
                                <LuFileText size={20} aria-hidden="true" />
                                <div>
                                    <strong>{media.titre || media.url.split('/').pop()}</strong>
                                    {media.legende && <span>{media.legende}</span>}
                                    {media.credit && <small>{media.credit}</small>}
                                </div>
                                <a className="rdc-button rdc-button-ghost" href={mediaUrl(media.url)} target="_blank" rel="noopener noreferrer">
                                    {media.url.startsWith('/media/') ? <LuDownload size={16} /> : <LuExternalLink size={16} />}
                                    Consulter
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {openIndex !== null && visuals[openIndex] && (
                <Lightbox items={visuals} index={openIndex} onClose={close} onMove={move} />
            )}
        </div>
    );
};

export default MediaGallery;
