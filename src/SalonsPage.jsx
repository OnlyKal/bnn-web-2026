import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaArrowLeft,
    FaBell,
    FaCheck,
    FaEdit,
    FaFileAlt,
    FaImage,
    FaInfoCircle,
    FaLink,
    FaPaperclip,
    FaPaperPlane,
    FaPlus,
    FaSearch,
    FaSignOutAlt,
    FaTimes,
    FaTrash,
    FaUsers
} from 'react-icons/fa';
import { salonsAPI } from './api';
import { getCurrentUser, isAuthenticated } from './utils/auth';
import { getMediaUrl } from './config';
import { useToast } from './hooks/useToast';
import { ToastContainer } from './components/ToastContainer';
import AppNavigation from './components/AppNavigation';
import { addLocalHistoryItem } from './utils/localHistory';

const emptySalonForm = {
    titre: '',
    description: '',
    fichiers: [],
    images: [],
    liens: ''
};

const extractList = (response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.data)) return response.data;
    if (Array.isArray(response.results)) return response.results;
    if (Array.isArray(response.results?.data)) return response.results.data;
    return [];
};

const extractObject = (response) => {
    if (!response) return null;
    if (response.data && !Array.isArray(response.data)) return response.data;
    return response;
};

const splitLinks = (value) => value
    .split(/\n|,/)
    .map((link) => link.trim())
    .filter(Boolean);

const buildSalonFormData = (form) => {
    const formData = new FormData();
    formData.append('titre', form.titre.trim());
    formData.append('description', form.description.trim());
    form.fichiers.forEach((file) => formData.append('fichiers', file));
    form.images.forEach((image) => formData.append('images', image));
    splitLinks(form.liens).forEach((link) => formData.append('liens', link));
    return formData;
};

const buildResourcesFormData = (form) => {
    const formData = new FormData();
    form.fichiers.forEach((file) => formData.append('fichiers', file));
    form.images.forEach((image) => formData.append('images', image));
    splitLinks(form.liens).forEach((link) => formData.append('liens', link));
    return formData;
};

const getResourceCount = (form) => form.fichiers.length + form.images.length + splitLinks(form.liens).length;

const getFilesSummary = (files, fallback) => {
    if (!files?.length) return fallback;
    if (files.length === 1) return files[0].name;
    return `${files.length} fichiers selectionnes`;
};

const splitSelectedFiles = (files) => ({
    images: files.filter((file) => file.type?.startsWith('image/')),
    fichiers: files.filter((file) => !file.type?.startsWith('image/'))
});

const formatDateTime = (value) => {
    if (!value) return '';
    try {
        return new Date(value).toLocaleString('fr-FR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return value;
    }
};

const formatMessageTime = (value) => {
    if (!value) return '';
    try {
        return new Date(value).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return value;
    }
};

const getDateLabel = (value) => {
    if (!value) return '';
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isSameDay = (a, b) => a.toDateString() === b.toDateString();
    if (isSameDay(date, today)) return 'Aujourd\'hui';
    if (isSameDay(date, yesterday)) return 'Hier';

    return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
};

const getPersonSource = (person) => person?.user || person?.utilisateur || person?.membre || person?.profil || person?.profile || person;

const getPersonName = (person) => {
    if (!person) return 'Utilisateur';
    const source = getPersonSource(person);
    const nom = source.nom || source.last_name || source.name;
    const postnom = source.postnom || source.post_nom || source.middle_name;
    const prenom = source.prenom || source.first_name;
    const nomPostnom = nom && postnom ? `${nom} ${postnom}` : '';
    const nomPrenom = nom && prenom ? `${nom} ${prenom}` : '';
    const prenomNom = prenom && nom ? `${prenom} ${nom}` : '';

    return nomPostnom || nomPrenom || prenomNom || source.full_name || nom || prenom || source.username || source.email || 'Utilisateur';
};

const getPersonId = (person) => {
    const source = getPersonSource(person);
    return source?.id || source?.user_id || source?.pk || source?.uuid || source?.email || source?.username || null;
};

const getMessageAuthor = (message) => message.expediteur || message.auteur || message.createur || message.user || message.utilisateur || message.sender;

const getMessageDate = (message) => message.date_envoi || message.date_creation || message.created_at || message.timestamp || message.date;

const normalizeAttachment = (attachment) => {
    if (!attachment) return null;
    const url = typeof attachment === 'string'
        ? attachment
        : attachment.url || attachment.file || attachment.fichier || attachment.path;
    if (!url) return null;

    const name = typeof attachment === 'string'
        ? attachment.split('/').pop()
        : attachment.nom || attachment.name || attachment.filename || attachment.titre || url.split('/').pop() || 'Fichier joint';
    const contentType = typeof attachment === 'string' ? '' : attachment.content_type || attachment.type || '';
    const isImage = contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url);

    return {
        url: getMediaUrl(url),
        name,
        contentType,
        size: typeof attachment === 'string' ? null : attachment.taille || attachment.size,
        isImage
    };
};

const getMessageAttachments = (message) => {
    const modernAttachments = message.pieces_jointes || message.fichiers || message.files || message.images;
    if (Array.isArray(modernAttachments)) {
        return modernAttachments.map(normalizeAttachment).filter(Boolean);
    }

    const image = message.image || message.photo;
    const file = message.fichier || message.file || message.document || message.piece_jointe || message.attachment;
    const rawUrl = image || file;

    return rawUrl ? [normalizeAttachment(rawUrl)].filter(Boolean) : [];
};

const getMessageStatus = (message) => {
    if (message.lu || message.read) return 'read';
    if (message.recu || message.delivered) return 'delivered';
    return 'sent';
};

const getNotificationSalonId = (notification) => (
    notification.salon_id ||
    notification.salon?.id ||
    notification.message?.salon_id ||
    notification.message?.salon?.id ||
    notification.salon
);

const hasUnreadSalonMessages = (salon) => (
    salon.has_unread ||
    salon.a_non_lus ||
    salon.non_lu ||
    salon.unread ||
    salon.unread_count > 0 ||
    salon.non_lus_count > 0 ||
    salon.messages_non_lus_count > 0 ||
    salon.notifications_non_lues_count > 0
);

const getResourceUrl = (ressource) => {
    const rawUrl = ressource.url || ressource.lien || ressource.fichier || ressource.image || ressource.file;
    return rawUrl ? getMediaUrl(rawUrl) : null;
};

const SalonsPage = () => {
    const navigate = useNavigate();
    const currentUser = getCurrentUser();
    const { toasts, removeToast, showError, showSuccess, showInfo } = useToast();

    const [salons, setSalons] = useState([]);
    const [selectedSalon, setSelectedSalon] = useState(null);
    const [messages, setMessages] = useState([]);
    const [members, setMembers] = useState([]);
    const [notificationsCount, setNotificationsCount] = useState(0);
    const [unreadSalonIds, setUnreadSalonIds] = useState(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showResourceForm, setShowResourceForm] = useState(false);
    const [editing, setEditing] = useState(false);
    const [salonForm, setSalonForm] = useState(emptySalonForm);
    const [resourceForm, setResourceForm] = useState({ fichiers: [], images: [], liens: '' });
    const [editForm, setEditForm] = useState({ titre: '', description: '' });
    const [messageText, setMessageText] = useState('');
    const [messageFiles, setMessageFiles] = useState([]);
    const messagesEndRef = useRef(null);

    const selectedSalonId = selectedSalon?.id;
    const selectedSalonMembersCount = selectedSalon?.membres_count ?? members.length;
    const lastMessageId = useMemo(() => {
        if (!messages.length) return null;
        return messages[messages.length - 1]?.id || null;
    }, [messages]);

    const isCreator = useMemo(() => {
        const createur = selectedSalon?.createur;
        return !!createur && !!currentUser && (
            createur.id === currentUser.id ||
            createur.username === currentUser.username ||
            createur.email === currentUser.email
        );
    }, [selectedSalon, currentUser]);

    const currentUserId = useMemo(() => getPersonId(currentUser), [currentUser]);

    const fetchNotifications = useCallback(async () => {
        try {
            const response = await salonsAPI.getNotifications(true);
            const notifications = extractList(response);
            setNotificationsCount(notifications.length);
            setUnreadSalonIds(new Set(
                notifications
                    .map(getNotificationSalonId)
                    .filter(Boolean)
                    .map(String)
            ));
        } catch (error) {
            console.warn('Erreur notifications salons:', error.message);
        }
    }, []);

    const fetchSalons = useCallback(async (search = '') => {
        try {
            setLoading(true);
            const response = await salonsAPI.getSalons(search.trim());
            setSalons(extractList(response));
        } catch (error) {
            showError(error.message);
        } finally {
            setLoading(false);
        }
    }, [showError]);

    const fetchSalonDetail = useCallback(async (salonId) => {
        try {
            setDetailLoading(true);
            const response = await salonsAPI.getSalon(salonId);
            const salon = extractObject(response);
            setSelectedSalon(salon);
            setEditForm({
                titre: salon?.titre || '',
                description: salon?.description || ''
            });
            addLocalHistoryItem({
                type: 'salon',
                title: salon?.titre || 'Salon ouvert',
                description: salon?.description || 'Discussion consultée',
                url: '/salons',
                icon: 'salon',
                metadata: { salonId }
            });
            return salon;
        } catch (error) {
            showError(error.message);
            return null;
        } finally {
            setDetailLoading(false);
        }
    }, [showError]);

    const fetchMembers = useCallback(async (salonId) => {
        try {
            const response = await salonsAPI.getMembers(salonId);
            setMembers(extractList(response));
        } catch (error) {
            console.warn('Erreur membres salon:', error.message);
            setMembers([]);
        }
    }, []);

    const fetchMessages = useCallback(async (salonId, afterId = null) => {
        try {
            if (!afterId) setMessagesLoading(true);
            const response = await salonsAPI.getMessages(salonId, afterId);
            const newMessages = extractList(response);
            setMessages((previous) => {
                if (!afterId) return newMessages;
                const knownIds = new Set(previous.map((message) => message.id));
                const additions = newMessages.filter((message) => !knownIds.has(message.id));
                return additions.length ? [...previous, ...additions] : previous;
            });
        } catch (error) {
            if (!afterId) showError(error.message);
        } finally {
            setMessagesLoading(false);
        }
    }, [showError]);

    useEffect(() => {
        if (!isAuthenticated()) {
            navigate('/login');
            return;
        }
        fetchSalons('');
        fetchNotifications();
    }, [navigate, fetchSalons, fetchNotifications]);

    useEffect(() => {
        const timer = setTimeout(() => fetchSalons(searchTerm), 350);
        return () => clearTimeout(timer);
    }, [searchTerm, fetchSalons]);

    useEffect(() => {
        const query = searchTerm.trim();
        if (query.length < 2) return;

        const timer = setTimeout(() => {
            addLocalHistoryItem({
                type: 'search',
                title: query,
                description: 'Recherche effectuée dans les salons',
                url: '/salons',
                icon: 'search',
                metadata: { query: `salons:${query}` }
            });
        }, 450);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        const interval = setInterval(fetchNotifications, 20000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    useEffect(() => {
        if (!selectedSalonId || !selectedSalon?.est_membre) return undefined;
        const interval = setInterval(() => {
            fetchMessages(selectedSalonId, lastMessageId);
        }, 7000);
        return () => clearInterval(interval);
    }, [selectedSalonId, selectedSalon?.est_membre, lastMessageId, fetchMessages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages]);

    const handleSelectSalon = async (salon) => {
        setMessages([]);
        setMembers([]);
        setUnreadSalonIds((previous) => {
            const next = new Set(previous);
            next.delete(String(salon.id));
            return next;
        });
        const detail = await fetchSalonDetail(salon.id);
        fetchMembers(salon.id);
        if (detail?.est_membre) {
            fetchMessages(salon.id);
        }
    };

    const getSalonIndicatorStatus = (salon) => {
        if (selectedSalon?.id === salon.id) return 'active';
        if (unreadSalonIds.has(String(salon.id)) || hasUnreadSalonMessages(salon)) return 'unread';
        return 'idle';
    };

    const validateResources = (form, requireAtLeastOne = true) => {
        const count = getResourceCount(form);
        if (requireAtLeastOne && count < 1) {
            showError('Ajoutez au moins une ressource: fichier, image ou lien.');
            return false;
        }
        if (count > 5) {
            showError('Le salon accepte au maximum 5 ressources au total.');
            return false;
        }
        return true;
    };

    const handleCreateSalon = async (event) => {
        event.preventDefault();
        if (!salonForm.titre.trim() || !salonForm.description.trim()) {
            showError('Le titre et la description sont requis.');
            return;
        }
        if (!validateResources(salonForm)) return;

        try {
            setSubmitting(true);
            const response = await salonsAPI.createSalon(buildSalonFormData(salonForm));
            const createdSalon = extractObject(response);
            showSuccess('Salon cree avec succes.');
            setSalonForm(emptySalonForm);
            setShowCreateForm(false);
            await fetchSalons('');
            if (createdSalon?.id) handleSelectSalon(createdSalon);
        } catch (error) {
            showError(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateSalon = async (event) => {
        event.preventDefault();
        if (!selectedSalonId) return;
        try {
            setSubmitting(true);
            await salonsAPI.updateSalon(selectedSalonId, {
                titre: editForm.titre.trim(),
                description: editForm.description.trim()
            });
            showSuccess('Salon modifie avec succes.');
            setEditing(false);
            await fetchSalons(searchTerm);
            await fetchSalonDetail(selectedSalonId);
        } catch (error) {
            showError(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteSalon = async () => {
        if (!selectedSalonId) return;
        if (!window.confirm(`Supprimer le salon "${selectedSalon?.titre}" ?`)) return;
        try {
            setSubmitting(true);
            await salonsAPI.deleteSalon(selectedSalonId);
            showSuccess('Salon supprime.');
            setSelectedSalon(null);
            setMessages([]);
            await fetchSalons(searchTerm);
        } catch (error) {
            showError(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleJoinSalon = async () => {
        if (!selectedSalonId) return;
        try {
            setSubmitting(true);
            await salonsAPI.joinSalon(selectedSalonId);
            showSuccess('Vous avez rejoint le salon.');
            await fetchSalonDetail(selectedSalonId);
            await fetchMessages(selectedSalonId);
            await fetchMembers(selectedSalonId);
            await fetchSalons(searchTerm);
        } catch (error) {
            showError(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleQuitSalon = async () => {
        if (!selectedSalonId) return;
        try {
            setSubmitting(true);
            await salonsAPI.quitSalon(selectedSalonId);
            showInfo('Vous avez quitte le salon.');
            setMessages([]);
            setMembers([]);
            await fetchSalonDetail(selectedSalonId);
            await fetchSalons(searchTerm);
        } catch (error) {
            showError(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddResources = async (event) => {
        event.preventDefault();
        if (!selectedSalonId || !validateResources(resourceForm)) return;
        try {
            setSubmitting(true);
            await salonsAPI.addRessources(selectedSalonId, buildResourcesFormData(resourceForm));
            showSuccess('Ressources ajoutees.');
            setResourceForm({ fichiers: [], images: [], liens: '' });
            setShowResourceForm(false);
            await fetchSalonDetail(selectedSalonId);
        } catch (error) {
            showError(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSendMessage = async (event) => {
        event.preventDefault();
        if (!selectedSalonId) return;
        if (!messageText.trim() && messageFiles.length === 0) {
            showError('Un message vide sans fichier est refuse.');
            return;
        }
        try {
            setSubmitting(true);
            const payload = messageFiles.length > 0 ? new FormData() : { contenu: messageText.trim() };
            if (messageFiles.length > 0) {
                if (messageText.trim()) {
                    payload.append('contenu', messageText.trim());
                }
                messageFiles.forEach((file) => {
                    payload.append('pieces_jointes', file);
                });
            }
            await salonsAPI.sendMessage(selectedSalonId, payload);
            setMessageText('');
            setMessageFiles([]);
            await fetchMessages(selectedSalonId);
        } catch (error) {
            showError(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleMarkNotificationsRead = async () => {
        try {
            await salonsAPI.markNotificationsRead();
            setNotificationsCount(0);
            showSuccess('Notifications marquees comme lues.');
        } catch (error) {
            showError(error.message);
        }
    };

    const renderResource = (ressource) => {
        const url = getResourceUrl(ressource);
        const type = ressource.type || ressource.type_ressource || (ressource.image ? 'image' : ressource.lien ? 'lien' : 'fichier');
        const title = ressource.titre || ressource.nom || ressource.name || url || 'Ressource';
        const icon = type?.includes('image') ? <FaImage /> : type?.includes('lien') ? <FaLink /> : <FaFileAlt />;

        return (
            <a key={ressource.id || title} className="salon-resource-item" href={url || '#'} target="_blank" rel="noreferrer">
                {icon}
                <span>{title}</span>
            </a>
        );
    };

    const isOwnMessage = (message) => {
        if (typeof message.est_expediteur === 'boolean') return message.est_expediteur;
        const author = getMessageAuthor(message);
        const authorId = getPersonId(author);
        return !!currentUserId && !!authorId && authorId === currentUserId;
    };

    const renderAttachment = (attachment) => {
        if (!attachment?.url) return null;
        if (attachment.isImage) {
            return <img src={attachment.url} alt={attachment.name || 'Image jointe'} className="salon-message-image" />;
        }

        return (
            <a className="salon-message-attachment" href={attachment.url} target="_blank" rel="noreferrer">
                <FaFileAlt />
                <span>{attachment.name || 'Fichier joint'}</span>
            </a>
        );
    };

    const renderMessage = (message, index) => {
        const author = getMessageAuthor(message);
        const previousMessage = messages[index - 1];
        const previousAuthor = previousMessage ? getMessageAuthor(previousMessage) : null;
        const messageDate = getMessageDate(message);
        const previousDate = previousMessage ? getMessageDate(previousMessage) : null;
        const own = isOwnMessage(message);
        const sameAuthorAsPrevious = previousMessage && getPersonId(author) && getPersonId(author) === getPersonId(previousAuthor);
        const sameDayAsPrevious = previousDate && new Date(messageDate).toDateString() === new Date(previousDate).toDateString();
        const isGrouped = sameAuthorAsPrevious && sameDayAsPrevious;
        const showDateSeparator = !previousMessage || !sameDayAsPrevious;
        const attachments = getMessageAttachments(message);
        const status = getMessageStatus(message);

        return (
            <React.Fragment key={message.id || `${message.contenu}-${messageDate || index}`}>
                {showDateSeparator && (
                    <div className="salon-date-separator">
                        <span>{getDateLabel(messageDate)}</span>
                    </div>
                )}
                <div className={`salon-message-row ${own ? 'own' : 'other'} ${isGrouped ? 'grouped' : ''}`}>
                    <div className="salon-message-bubble">
                        {!isGrouped && (
                            <div className="salon-message-author">
                                <strong>{getPersonName(author)}</strong>
                            </div>
                        )}
                        {message.contenu && <p>{message.contenu}</p>}
                        {attachments.length > 0 && (
                            <div className="salon-message-attachments">
                                {attachments.map((attachment) => (
                                    <React.Fragment key={attachment.id || attachment.url || attachment.name}>
                                        {renderAttachment(attachment)}
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                        <div className="salon-message-status">
                            <time>{formatMessageTime(messageDate)}</time>
                            {own && (
                                <span className={`salon-message-checks ${status}`} aria-label={status}>
                                    <FaCheck />
                                    {status !== 'sent' && <FaCheck />}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </React.Fragment>
        );
    };

    const renderUploadField = ({ id, files, multiple = true, onChange }) => (
        <label className="salon-upload-field" htmlFor={id}>
            <span className="salon-upload-icon"><FaPaperclip /></span>
            <span className="salon-upload-copy">
                <span className="salon-upload-title">Joindre fichier(s)</span>
                {!!files?.length && <span className="salon-upload-hint">{getFilesSummary(files, '')}</span>}
            </span>
            <input
                id={id}
                type="file"
                accept="*/*"
                multiple={multiple}
                onChange={(event) => onChange(Array.from(event.target.files || []))}
            />
        </label>
    );

    return (
        <div className="salons-page">
            <ToastContainer toasts={toasts} onClose={removeToast} />

            <AppNavigation />

            <main className="salons-main">
                <div className="salons-page-toolbar">
                    <button className="salons-notification-btn" onClick={handleMarkNotificationsRead}>
                        <FaBell />
                        <span>{notificationsCount}</span>
                    </button>
                </div>
                <aside className="salons-list-panel">
                    <div className="salons-list-tools">
                        <div className="salons-search-box">
                            <FaSearch />
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Rechercher un salon"
                            />
                        </div>
                        <button className="salons-primary-btn" onClick={() => setShowCreateForm((value) => !value)}>
                            <FaPlus />
                            Nouveau
                        </button>
                    </div>

                    {showCreateForm && (
                        <form className="salons-form" onSubmit={handleCreateSalon}>
                            <div className="salons-field-group">
                                <label htmlFor="salon-titre">Titre du salon</label>
                                <input
                                    id="salon-titre"
                                    type="text"
                                    value={salonForm.titre}
                                    onChange={(event) => setSalonForm({ ...salonForm, titre: event.target.value })}
                                    placeholder="Ex: Salon recherche"
                                />
                            </div>
                            <div className="salons-field-group">
                                <label htmlFor="salon-description">Description</label>
                                <textarea
                                    id="salon-description"
                                    value={salonForm.description}
                                    onChange={(event) => setSalonForm({ ...salonForm, description: event.target.value })}
                                    placeholder="Decrivez le sujet de discussion"
                                    rows="3"
                                />
                            </div>
                            {renderUploadField({
                                id: 'salon-fichiers',
                                files: [...salonForm.fichiers, ...salonForm.images],
                                onChange: (files) => setSalonForm({ ...salonForm, ...splitSelectedFiles(files) })
                            })}
                            <div className="salons-field-group">
                                <label htmlFor="salon-liens">Liens</label>
                                <textarea
                                    id="salon-liens"
                                    value={salonForm.liens}
                                    onChange={(event) => setSalonForm({ ...salonForm, liens: event.target.value })}
                                    placeholder="https://exemple.com"
                                    rows="2"
                                />
                            </div>
                            <div className="salons-form-footer">
                                <span>{getResourceCount(salonForm)} / 5 ressources</span>
                                <button type="submit" disabled={submitting}>{submitting ? 'Creation...' : 'Creer'}</button>
                            </div>
                        </form>
                    )}

                    <div className="salons-list">
                        {loading && <div className="salons-empty-state">Chargement des salons...</div>}
                        {!loading && salons.length === 0 && <div className="salons-empty-state">Aucun salon trouve</div>}
                        {!loading && salons.map((salon) => {
                            const indicatorStatus = getSalonIndicatorStatus(salon);
                            return (
                                <button
                                    key={salon.id}
                                    className={`salon-list-item ${selectedSalon?.id === salon.id ? 'active' : ''}`}
                                    onClick={() => handleSelectSalon(salon)}
                                >
                                    <span className="salon-list-title-row">
                                        <span className={`salon-conversation-dot ${indicatorStatus}`} aria-hidden="true"></span>
                                        <span className="salon-list-title">{salon.titre}</span>
                                    </span>
                                    <span className="salon-list-description">{salon.description}</span>
                                    <span className="salon-list-stats">
                                        <FaUsers /> {salon.membres_count || 0}
                                        <FaPaperPlane /> {salon.messages_count || 0}
                                        {salon.est_membre ? 'Membre' : 'A rejoindre'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="salons-left-members">
                        <div className="salons-left-members-header">
                            <h3>
                                <FaUsers />
                                Membres du salon
                            </h3>
                            {selectedSalon && <span>{selectedSalonMembersCount || 0}</span>}
                        </div>
                        {!selectedSalon && (
                            <div className="salons-left-members-empty">Selectionnez un salon</div>
                        )}
                        {selectedSalon && members.length === 0 && (
                            <div className="salons-left-members-empty">Aucun membre affiche</div>
                        )}
                        {selectedSalon && members.length > 0 && (
                            <div className="salons-left-members-list">
                                {members.map((member) => (
                                    <div className="salons-left-member" key={member.id || getPersonName(member)}>
                                        <span>{getPersonName(member).charAt(0).toUpperCase()}</span>
                                        <strong>{getPersonName(member)}</strong>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>

                <section className="salons-detail-panel">
                    {!selectedSalon && (
                        <div className="salons-detail-empty">
                            <FaUsers />
                            <h2>Selectionnez un salon</h2>
                            <p>Choisissez un salon dans la liste pour voir ses ressources et participer aux messages.</p>
                        </div>
                    )}

                    {selectedSalon && (
                        <>
                            <div className="salon-detail-header">
                                {editing ? (
                                    <form className="salon-edit-form" onSubmit={handleUpdateSalon}>
                                        <input
                                            value={editForm.titre}
                                            onChange={(event) => setEditForm({ ...editForm, titre: event.target.value })}
                                        />
                                        <textarea
                                            value={editForm.description}
                                            onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                                            rows="2"
                                        />
                                        <div>
                                            <button type="submit" disabled={submitting}>Enregistrer</button>
                                            <button type="button" onClick={() => setEditing(false)}>Annuler</button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="salon-conversation-title">
                                        <h2>Messages</h2>
                                        <p>{selectedSalon.titre}</p>
                                        <span>
                                            <FaUsers />
                                            {selectedSalonMembersCount || 0} participant(s)
                                        </span>
                                    </div>
                                )}

                                <div className="salon-detail-actions">
                                    {selectedSalon.est_membre && (
                                        <button className="salons-secondary-btn" onClick={() => fetchMessages(selectedSalonId)}>
                                            Actualiser
                                        </button>
                                    )}
                                    <button className="salons-secondary-btn" onClick={() => showInfo(selectedSalon.description || 'Aucune description disponible.')}>
                                        <FaInfoCircle />
                                        Infos
                                    </button>
                                    {!selectedSalon.est_membre && (
                                        <button className="salons-primary-btn" onClick={handleJoinSalon} disabled={submitting}>
                                            <FaUsers />
                                            Joindre
                                        </button>
                                    )}
                                    {selectedSalon.est_membre && !isCreator && (
                                        <button className="salons-secondary-btn" onClick={handleQuitSalon} disabled={submitting}>
                                            <FaSignOutAlt />
                                            Quitter
                                        </button>
                                    )}
                                    {isCreator && (
                                        <>
                                            <button className="salons-secondary-btn" onClick={() => setEditing(true)}>
                                                <FaEdit />
                                                Modifier
                                            </button>
                                            <button className="salons-secondary-btn" onClick={() => setShowResourceForm((value) => !value)}>
                                                <FaPlus />
                                                Ressources
                                            </button>
                                            <button className="salons-danger-btn" onClick={handleDeleteSalon} disabled={submitting}>
                                                <FaTrash />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {detailLoading && <div className="salons-empty-state">Chargement du detail...</div>}

                            {showResourceForm && isCreator && (
                                <form className="salons-form salon-resource-form" onSubmit={handleAddResources}>
                                    {renderUploadField({
                                        id: 'salon-resource-fichiers',
                                        files: [...resourceForm.fichiers, ...resourceForm.images],
                                        onChange: (files) => setResourceForm({ ...resourceForm, ...splitSelectedFiles(files) })
                                    })}
                                    <div className="salons-field-group">
                                        <label htmlFor="salon-resource-liens">Liens</label>
                                        <textarea
                                            id="salon-resource-liens"
                                            value={resourceForm.liens}
                                            onChange={(event) => setResourceForm({ ...resourceForm, liens: event.target.value })}
                                            placeholder="https://exemple.com"
                                            rows="2"
                                        />
                                    </div>
                                    <div className="salons-form-footer">
                                        <span>{getResourceCount(resourceForm)} / 5 nouvelles ressources</span>
                                        <button type="submit" disabled={submitting}>{submitting ? 'Ajout...' : 'Ajouter'}</button>
                                    </div>
                                </form>
                            )}

                            <div className="salon-detail-grid salon-detail-grid-single">
                                <div className="salon-resources-section">
                                    <h3>Ressources</h3>
                                    <div className="salon-resources-list">
                                        {extractList(selectedSalon.ressources).length > 0
                                            ? extractList(selectedSalon.ressources).map(renderResource)
                                            : <span className="salons-muted">Aucune ressource affichee</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="salon-messages-section">
                                {!selectedSalon.est_membre && (
                                    <div className="salons-empty-state">Rejoignez ce salon pour consulter et envoyer des messages.</div>
                                )}

                                {selectedSalon.est_membre && (
                                    <>
                                        <div className="salon-messages-list">
                                            {messagesLoading && <div className="salons-empty-state">Chargement des messages...</div>}
                                            {!messagesLoading && messages.length === 0 && <div className="salons-empty-state">Aucun message pour le moment</div>}
                                            {messages.map((message, index) => renderMessage(message, index))}
                                            {submitting && (
                                                <div className="salon-typing-indicator">
                                                    <span></span>
                                                    <span></span>
                                                    <span></span>
                                                    Envoi en cours...
                                                </div>
                                            )}
                                            <div ref={messagesEndRef} />
                                        </div>

                                        <div className="salon-composer">
                                            {messageFiles.length > 0 && (
                                                <div className="salon-file-preview-list">
                                                    {messageFiles.map((file, index) => (
                                                        <div className="salon-file-preview" key={`${file.name}-${file.size}-${index}`}>
                                                            <FaFileAlt />
                                                            <span>{file.name}</span>
                                                            <button
                                                                type="button"
                                                                aria-label={`Retirer ${file.name}`}
                                                                onClick={() => setMessageFiles((files) => files.filter((_, fileIndex) => fileIndex !== index))}
                                                            >
                                                                <FaTimes />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {submitting && (
                                                <div className="salon-upload-progress">
                                                    <span></span>
                                                </div>
                                            )}
                                            <form className="salon-message-form" onSubmit={handleSendMessage}>
                                                <label className="salon-file-picker" title="Joindre un fichier" aria-label="Joindre un fichier">
                                                    <FaPaperclip />
                                                    <input
                                                        type="file"
                                                        accept="*/*"
                                                        multiple
                                                        disabled={submitting}
                                                        onChange={(event) => setMessageFiles(Array.from(event.target.files || []))}
                                                    />
                                                </label>
                                                <textarea
                                                    value={messageText}
                                                    onChange={(event) => setMessageText(event.target.value)}
                                                    placeholder="Ecrire un message"
                                                    rows="2"
                                                    disabled={submitting}
                                                />
                                                <button type="submit" disabled={submitting} aria-label="Envoyer le message">
                                                    <FaPaperPlane />
                                                </button>
                                            </form>
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </section>
            </main>
        </div>
    );
};

export default SalonsPage;
