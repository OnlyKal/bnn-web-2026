import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    FaBookOpen,
    FaEdit,
    FaFileAlt,
    FaFlag,
    FaReply,
    FaThumbtack,
    FaTrash
} from 'react-icons/fa';
import {
    SHARE_SOURCES,
    formatMessageTime,
    formatSize,
    getDateLabel,
    personName,
    sharedResourceLink,
    splitMentions
} from './salonUtils';

const MessageText = ({ text, mentions }) => (
    <p>
        {splitMentions(text, mentions).map((part, index) => (
            part.mention
                ? <span key={index} className="salon-mention">{part.text}</span>
                : <React.Fragment key={index}>{part.text}</React.Fragment>
        ))}
    </p>
);

const SharedResource = ({ resource }) => {
    const link = sharedResourceLink(resource);
    const content = (
        <>
            <FaBookOpen />
            <span>
                <small>{SHARE_SOURCES[resource.source]?.label || 'Ressource'}</small>
                <strong>{resource.titre}</strong>
                {resource.auteurs && <em>{resource.auteurs}</em>}
            </span>
        </>
    );
    if (!link) return <div className="salon-shared-resource">{content}</div>;
    return link.internal
        ? <Link className="salon-shared-resource" to={link.href}>{content}</Link>
        : <a className="salon-shared-resource" href={link.href} target="_blank" rel="noopener noreferrer">{content}</a>;
};

const Attachment = ({ attachment }) => {
    const isImage = (attachment.content_type || '').startsWith('image/');
    if (isImage) {
        return (
            <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                <img src={attachment.url} alt={attachment.nom || 'Image jointe'} className="salon-message-image" />
            </a>
        );
    }
    return (
        <a className="salon-message-attachment" href={attachment.url} target="_blank" rel="noopener noreferrer">
            <FaFileAlt />
            <span>{attachment.nom || 'Fichier joint'}</span>
            {attachment.taille ? <small>{formatSize(attachment.taille)}</small> : null}
        </a>
    );
};

const MessageItem = ({ message, previous, own, isCreator, readOnly, onReply, onEdit, onDelete, onPin, onReport, highlight }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(message.contenu || '');
    const date = message.date_envoi;
    const sameDay = previous && new Date(previous.date_envoi).toDateString() === new Date(date).toDateString();
    const grouped = sameDay && previous.expediteur?.id === message.expediteur?.id && !message.reponse_a;
    const attachments = [
        ...(message.image_url ? [{ id: 'image', url: message.image_url, content_type: 'image/*', nom: 'Image' }] : []),
        ...(message.pieces_jointes || [])
    ];

    const saveEdit = async (event) => {
        event.preventDefault();
        const ok = await onEdit(message, draft);
        if (ok) setEditing(false);
    };

    return (
        <>
            {!sameDay && (
                <div className="salon-date-separator"><span>{getDateLabel(date)}</span></div>
            )}
            <div
                id={`salon-message-${message.id}`}
                className={`salon-message-row ${own ? 'own' : 'other'} ${grouped ? 'grouped' : ''} ${highlight ? 'highlight' : ''}`}
            >
                <div className={`salon-message-bubble ${message.supprime ? 'deleted' : ''}`}>
                    {!grouped && (
                        <div className="salon-message-author">
                            <strong>{personName(message.expediteur)}</strong>
                            {message.epingle && <FaThumbtack className="salon-pin-icon" title="Message épinglé" />}
                        </div>
                    )}

                    {message.reponse_a && (
                        <a className="salon-reply-quote" href={`#salon-message-${message.reponse_a.id}`}>
                            <strong>{message.reponse_a.expediteur?.nom_complet || 'Message'}</strong>
                            <span>{message.reponse_a.supprime ? 'Message supprimé' : message.reponse_a.extrait || 'Pièce jointe'}</span>
                        </a>
                    )}

                    {message.supprime && <p className="salon-deleted-text">Message supprimé</p>}

                    {!message.supprime && editing && (
                        <form className="salon-edit-message" onSubmit={saveEdit}>
                            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows="2" autoFocus />
                            <div>
                                <button type="submit">Enregistrer</button>
                                <button type="button" onClick={() => { setEditing(false); setDraft(message.contenu || ''); }}>Annuler</button>
                            </div>
                        </form>
                    )}

                    {!message.supprime && !editing && message.contenu && (
                        <MessageText text={message.contenu} mentions={message.mentions} />
                    )}

                    {!message.supprime && message.ressource_partagee && <SharedResource resource={message.ressource_partagee} />}

                    {!message.supprime && attachments.length > 0 && (
                        <div className="salon-message-attachments">
                            {attachments.map((attachment) => <Attachment key={attachment.id || attachment.url} attachment={attachment} />)}
                        </div>
                    )}

                    <div className="salon-message-status">
                        <time dateTime={date}>{formatMessageTime(date)}</time>
                        {message.modifie && <span className="salon-edited">modifié</span>}
                    </div>

                    {!message.supprime && !editing && (
                        <div className="salon-message-actions">
                            {!readOnly && <button type="button" title="Répondre" onClick={() => onReply(message)}><FaReply /></button>}
                            {own && !readOnly && <button type="button" title="Modifier" onClick={() => setEditing(true)}><FaEdit /></button>}
                            {isCreator && !readOnly && (
                                <button type="button" title={message.epingle ? 'Désépingler' : 'Épingler'} onClick={() => onPin(message)}>
                                    <FaThumbtack />
                                </button>
                            )}
                            {(isCreator || (own && !readOnly)) && <button type="button" title="Supprimer" onClick={() => onDelete(message)}><FaTrash /></button>}
                            {!own && <button type="button" title="Signaler" onClick={() => onReport(message)}><FaFlag /></button>}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

const MessageList = ({
    messages,
    loading,
    hasMore,
    loadingMore,
    onLoadMore,
    currentUserId,
    isCreator,
    readOnly = false,
    typingNames,
    highlightId,
    endRef,
    ...actions
}) => (
    <div className="salon-messages-list">
        {hasMore && (
            <button type="button" className="salon-load-more" onClick={onLoadMore} disabled={loadingMore}>
                {loadingMore ? 'Chargement…' : 'Charger les messages précédents'}
            </button>
        )}
        {loading && <div className="salons-empty-state">Chargement des messages…</div>}
        {!loading && messages.length === 0 && <div className="salons-empty-state">Aucun message pour le moment</div>}
        {messages.map((message, index) => (
            <MessageItem
                key={message.id}
                message={message}
                previous={messages[index - 1]}
                own={message.expediteur?.id === currentUserId}
                isCreator={isCreator}
                readOnly={readOnly}
                highlight={highlightId === message.id}
                {...actions}
            />
        ))}
        {typingNames.length > 0 && (
            <div className="salon-typing-indicator">
                <span></span><span></span><span></span>
                {typingNames.join(', ')} {typingNames.length > 1 ? 'écrivent' : 'écrit'}…
            </div>
        )}
        <div ref={endRef} />
    </div>
);

export default MessageList;
