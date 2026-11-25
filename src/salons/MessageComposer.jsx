import React, { useMemo, useRef, useState } from 'react';
import { FaBookOpen, FaFileAlt, FaPaperclip, FaPaperPlane, FaTimes } from 'react-icons/fa';
import SharePicker from './SharePicker';
import { ACCEPTED_FILES, MAX_ATTACHMENTS, SHARE_SOURCES, checkFile, personName } from './salonUtils';

const TYPING_INTERVAL = 3000;

/** Zone de saisie : texte avec @mentions, réponse, pièces jointes et ressource partagée. */
const MessageComposer = ({ members, replyTo, onCancelReply, onSend, onTyping, onError, sending }) => {
    const [text, setText] = useState('');
    const [files, setFiles] = useState([]);
    const [shared, setShared] = useState(null);
    const [showShare, setShowShare] = useState(false);
    const [mentionQuery, setMentionQuery] = useState(null);
    const textareaRef = useRef(null);
    const lastTypingRef = useRef(0);

    const suggestions = useMemo(() => {
        if (mentionQuery === null) return [];
        const q = mentionQuery.toLowerCase();
        return members
            .map((m) => m.utilisateur)
            .filter((u) => u && (u.username.toLowerCase().startsWith(q) || personName(u).toLowerCase().includes(q)))
            .slice(0, 6);
    }, [members, mentionQuery]);

    const handleChange = (event) => {
        const value = event.target.value;
        setText(value);
        const caret = event.target.selectionStart;
        const match = value.slice(0, caret).match(/@([\w.+-]*)$/);
        setMentionQuery(match ? match[1] : null);
        const now = Date.now();
        if (value && now - lastTypingRef.current > TYPING_INTERVAL) {
            lastTypingRef.current = now;
            onTyping();
        }
    };

    const insertMention = (user) => {
        const textarea = textareaRef.current;
        const caret = textarea?.selectionStart ?? text.length;
        const before = text.slice(0, caret).replace(/@([\w.+-]*)$/, `@${user.username} `);
        setText(before + text.slice(caret));
        setMentionQuery(null);
        textarea?.focus();
    };

    const pickFiles = (list) => {
        const picked = Array.from(list || []);
        const all = [...files, ...picked];
        if (all.length > MAX_ATTACHMENTS) {
            onError(`${MAX_ATTACHMENTS} pièces jointes maximum par message.`);
            return;
        }
        const error = picked.map(checkFile).find(Boolean);
        if (error) {
            onError(error);
            return;
        }
        setFiles(all);
    };

    const submit = async (event) => {
        event?.preventDefault();
        if (!text.trim() && !files.length && !shared) {
            onError('Un message vide sans fichier est refusé.');
            return;
        }
        const ok = await onSend({ text: text.trim(), files, shared });
        if (ok) {
            setText('');
            setFiles([]);
            setShared(null);
            setMentionQuery(null);
        }
    };

    const handleKeyDown = (event) => {
        if (suggestions.length && (event.key === 'Tab' || event.key === 'Enter')) {
            event.preventDefault();
            insertMention(suggestions[0]);
            return;
        }
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
        }
    };

    return (
        <div className="salon-composer">
            {showShare && (
                <SharePicker
                    onClose={() => setShowShare(false)}
                    onPick={(item) => { setShared(item); setShowShare(false); }}
                />
            )}

            {replyTo && (
                <div className="salon-reply-bar">
                    <span>
                        Réponse à <strong>{personName(replyTo.expediteur)}</strong> : {(replyTo.contenu || 'Pièce jointe').slice(0, 80)}
                    </span>
                    <button type="button" onClick={onCancelReply} aria-label="Annuler la réponse"><FaTimes /></button>
                </div>
            )}

            {(files.length > 0 || shared) && (
                <div className="salon-file-preview-list">
                    {shared && (
                        <div className="salon-file-preview">
                            <FaBookOpen />
                            <span>{SHARE_SOURCES[shared.source]?.label} : {shared.titre}</span>
                            <button type="button" aria-label="Retirer la ressource" onClick={() => setShared(null)}><FaTimes /></button>
                        </div>
                    )}
                    {files.map((file, index) => (
                        <div className="salon-file-preview" key={`${file.name}-${file.size}-${index}`}>
                            <FaFileAlt />
                            <span>{file.name}</span>
                            <button
                                type="button"
                                aria-label={`Retirer ${file.name}`}
                                onClick={() => setFiles((list) => list.filter((_, i) => i !== index))}
                            >
                                <FaTimes />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {sending && <div className="salon-upload-progress"><span></span></div>}

            {suggestions.length > 0 && (
                <div className="salon-mention-suggestions" role="listbox">
                    {suggestions.map((user) => (
                        <button type="button" key={user.id} onMouseDown={(event) => { event.preventDefault(); insertMention(user); }}>
                            {personName(user)} <small>@{user.username}</small>
                        </button>
                    ))}
                </div>
            )}

            <form className="salon-message-form salon-message-form-v2" onSubmit={submit}>
                <label className="salon-file-picker" title="Joindre un fichier" aria-label="Joindre un fichier">
                    <FaPaperclip />
                    <input
                        type="file"
                        accept={ACCEPTED_FILES}
                        multiple
                        disabled={sending}
                        onChange={(event) => { pickFiles(event.target.files); event.target.value = ''; }}
                    />
                </label>
                <button
                    type="button"
                    className="salon-file-picker"
                    title="Partager une ressource de la bibliothèque"
                    aria-label="Partager une ressource"
                    onClick={() => setShowShare((v) => !v)}
                >
                    <FaBookOpen />
                </button>
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Écrire un message (@ pour mentionner, Maj+Entrée pour aller à la ligne)"
                    rows="2"
                    maxLength={5000}
                    disabled={sending}
                />
                <button type="submit" disabled={sending} aria-label="Envoyer le message">
                    <FaPaperPlane />
                </button>
            </form>
        </div>
    );
};

export default MessageComposer;
