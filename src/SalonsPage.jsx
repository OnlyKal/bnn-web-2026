import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaBell,
    FaClock,
    FaEdit,
    FaFileAlt,
    FaFlag,
    FaImage,
    FaInfoCircle,
    FaLink,
    FaLock,
    FaLockOpen,
    FaPlus,
    FaSearch,
    FaSignOutAlt,
    FaThumbtack,
    FaTimes,
    FaTrash,
    FaUsers
} from 'react-icons/fa';
import { salonsAPI } from './api';
import { getCurrentUser, isAuthenticated } from './utils/auth';
import { useToast } from './hooks/useToast';
import { ToastContainer } from './components/ToastContainer';
import AppNavigation from './components/AppNavigation';
import { addLocalHistoryItem } from './utils/localHistory';
import SalonList from './salons/SalonList';
import MembersPanel from './salons/MembersPanel';
import VisibilityBadge from './salons/VisibilityBadge';
import MessageList from './salons/MessageList';
import MessageComposer from './salons/MessageComposer';
import ReportsPanel from './salons/ReportsPanel';
import { AddResourcesForm, EditSalonForm } from './salons/SalonForms';
import useSalonSocket from './salons/useSalonSocket';
import OpeningPopup from './salons/OpeningPopup';
import {
    MAX_RESOURCES,
    STATUT_LABELS,
    buildResourcesFormData,
    extractList,
    formatOuverture,
    formatShortDate,
    isNotYetOpen,
    personName
} from './salons/salonUtils';
import './salons/salons.css';

const POLL_MESSAGES_MS = 7000;
const POLL_LIST_MS = 30000;
const POLL_LIST_CONNECTED_MS = 120000;
const TYPING_TTL_MS = 4000;

const SalonsPage = () => {
    const navigate = useNavigate();
    const currentUser = getCurrentUser();
    const currentUserId = currentUser?.id ?? currentUser?.user?.id ?? null;
    const { toasts, removeToast, showError, showSuccess, showInfo } = useToast();

    const [salons, setSalons] = useState([]);
    const [filter, setFilter] = useState('');
    const [closedCount, setClosedCount] = useState(0);
    const [openingMessage, setOpeningMessage] = useState('');
    const closeOpeningPopup = useCallback(() => setOpeningMessage(''), []);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedSalon, setSelectedSalon] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [messages, setMessages] = useState([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [members, setMembers] = useState([]);
    const [requests, setRequests] = useState([]);
    const [invites, setInvites] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showResourceForm, setShowResourceForm] = useState(false);
    const [editing, setEditing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [sending, setSending] = useState(false);
    const [replyTo, setReplyTo] = useState(null);
    const [typing, setTyping] = useState({});
    const [messageSearch, setMessageSearch] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [highlightId, setHighlightId] = useState(null);
    const [reports, setReports] = useState(null);
    const messagesEndRef = useRef(null);
    const selectedIdRef = useRef(null);
    const stickToBottomRef = useRef(true);

    const selectedId = selectedSalon?.id ?? null;
    selectedIdRef.current = selectedId;
    const isCreator = !!selectedSalon?.est_createur;
    const isMember = !!selectedSalon?.est_membre;
    const isClosed = !!selectedSalon?.ferme;
    const lastMessageId = messages.length ? messages[messages.length - 1].id : null;

    // ---------------------------------------------------------------- chargements

    const fetchSalons = useCallback(async () => {
        try {
            const response = await salonsAPI.getSalons(searchTerm.trim(), filter);
            setSalons(extractList(response));
            setClosedCount(response?.fermes_count ?? 0);
        } catch (error) {
            showError(error.message);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, filter, showError]);

    const fetchNotifications = useCallback(async () => {
        try {
            const response = await salonsAPI.getNotifications(false);
            setNotifications(extractList(response).slice(0, 20));
            setUnreadNotifications(response?.non_lues_count ?? 0);
        } catch (error) {
            console.warn('Notifications salons :', error.message);
        }
    }, []);

    const fetchDetail = useCallback(async (salonId) => {
        const response = await salonsAPI.getSalon(salonId);
        const salon = response?.data || null;
        if (salonId === selectedIdRef.current || selectedIdRef.current === null) setSelectedSalon(salon);
        return salon;
    }, []);

    const fetchMembers = useCallback(async (salonId) => {
        try {
            const response = await salonsAPI.getMembers(salonId);
            setMembers(extractList(response));
            setRequests(response?.demandes || []);
            setInvites(response?.invites || []);
        } catch {
            setMembers([]);
            setRequests([]);
            setInvites([]);
        }
    }, []);

    const fetchLatestMessages = useCallback(async (salonId) => {
        try {
            setMessagesLoading(true);
            const response = await salonsAPI.getMessages(salonId);
            if (salonId !== selectedIdRef.current) return;
            stickToBottomRef.current = true;
            setMessages(extractList(response));
            setHasMore(!!response?.has_more);
            // Le serveur a marqué le salon comme lu : on remet le compteur à zéro ici aussi.
            setSalons((list) => list.map((s) => (s.id === salonId ? { ...s, non_lus_count: 0 } : s)));
        } catch (error) {
            showError(error.message);
        } finally {
            setMessagesLoading(false);
        }
    }, [showError]);

    const fetchNewMessages = useCallback(async (salonId, afterId) => {
        try {
            const response = await salonsAPI.getMessages(salonId, { afterId });
            if (salonId !== selectedIdRef.current) return;
            const fresh = extractList(response);
            if (fresh.length) {
                stickToBottomRef.current = true;
                setMessages((list) => {
                    const known = new Set(list.map((m) => m.id));
                    return [...list, ...fresh.filter((m) => !known.has(m.id))];
                });
            }
        } catch {
            // Nouvel essai au prochain cycle.
        }
    }, []);

    const loadOlder = useCallback(async () => {
        if (!selectedId || !messages.length) return [];
        try {
            setLoadingMore(true);
            stickToBottomRef.current = false;
            const response = await salonsAPI.getMessages(selectedId, { beforeId: messages[0].id });
            const older = extractList(response);
            setMessages((list) => [...older, ...list]);
            setHasMore(!!response?.has_more);
            return older;
        } catch (error) {
            showError(error.message);
            return [];
        } finally {
            setLoadingMore(false);
        }
    }, [selectedId, messages, showError]);

    // ---------------------------------------------------------------- temps réel

    const upsertMessage = useCallback((message) => {
        setMessages((list) => {
            const index = list.findIndex((m) => m.id === message.id);
            if (index === -1) return [...list, message];
            const copy = list.slice();
            copy[index] = message;
            return copy;
        });
    }, []);

    const handleSocketEvent = useCallback((event, payload) => {
        const current = selectedIdRef.current;
        switch (event) {
            case 'message.created': {
                const own = payload.expediteur?.id === currentUserId;
                if (payload.salon === current) {
                    stickToBottomRef.current = true;
                    upsertMessage(payload);
                    if (!own) salonsAPI.markRead(current, payload.id).catch(() => {});
                    setTyping((t) => {
                        const copy = { ...t };
                        delete copy[payload.expediteur?.id];
                        return copy;
                    });
                } else if (!own) {
                    setSalons((list) => list.map((s) => (
                        s.id === payload.salon ? { ...s, non_lus_count: (s.non_lus_count || 0) + 1, messages_count: (s.messages_count || 0) + 1 } : s
                    )));
                }
                break;
            }
            case 'message.updated':
            case 'message.deleted':
            case 'message.pinned':
                if (payload.salon === current) {
                    stickToBottomRef.current = false;
                    setMessages((list) => list.map((m) => (m.id === payload.id ? payload : m)));
                    if (event !== 'message.updated') fetchDetail(current).catch(() => {});
                }
                break;
            case 'typing':
                if (payload.salon_id === current && payload.utilisateur?.id !== currentUserId) {
                    setTyping((t) => ({
                        ...t,
                        [payload.utilisateur.id]: { name: payload.utilisateur.nom_complet, until: Date.now() + TYPING_TTL_MS }
                    }));
                }
                break;
            case 'salon.updated':
                if (payload.salon_id === current) fetchDetail(current).catch(() => {});
                fetchSalons();
                break;
            case 'salon.deleted':
                if (payload.salon_id === current) {
                    showInfo('Ce salon a été supprimé par son créateur.');
                    setSelectedSalon(null);
                    setMessages([]);
                }
                fetchSalons();
                break;
            case 'members.updated':
                if (payload.salon_id === current) {
                    fetchMembers(current);
                    fetchDetail(current).catch(() => {});
                }
                break;
            case 'membership.changed':
                fetchSalons();
                if (payload.salon_id === current) {
                    fetchDetail(current).then((salon) => {
                        if (salon?.est_membre) fetchLatestMessages(current);
                        else setMessages([]);
                    }).catch(() => {});
                }
                break;
            case 'notification.new':
                if (payload.salon_id === current && payload.type !== 'demande' && payload.type !== 'signalement') {
                    // Salon ouvert à l'écran : la notification est déjà « vue ».
                    salonsAPI.markNotificationRead(payload.id).catch(() => {});
                    setNotifications((list) => [{ ...payload, lu: true }, ...list].slice(0, 20));
                } else {
                    setUnreadNotifications((n) => n + 1);
                    setNotifications((list) => [payload, ...list].slice(0, 20));
                    showInfo(payload.message);
                }
                break;
            default:
                break;
        }
    }, [currentUserId, upsertMessage, fetchDetail, fetchSalons, fetchMembers, fetchLatestMessages, showInfo]);

    const { connected, followSalons, sendTyping } = useSalonSocket(handleSocketEvent);

    useEffect(() => {
        const ids = salons.filter((s) => s.est_membre).map((s) => s.id);
        if (selectedSalon?.est_membre && !ids.includes(selectedSalon.id)) ids.push(selectedSalon.id);
        followSalons(ids);
    }, [salons, selectedSalon, followSalons, connected]);

    // ---------------------------------------------------------------- effets

    useEffect(() => {
        if (!isAuthenticated()) navigate('/login');
    }, [navigate]);

    // Lien d'invitation (/salons?invitation=...) : on rejoint le salon puis on l'ouvre.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        // Le lien peut aussi avoir été gardé avant le passage par la page de connexion.
        const token = params.get('invitation') || localStorage.getItem('bnn.salonInvitation');
        if (!token || !isAuthenticated()) return;
        localStorage.removeItem('bnn.salonInvitation');
        params.delete('invitation');
        const rest = params.toString();
        window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
        (async () => {
            try {
                const response = await salonsAPI.joinByInvitation(token);
                showSuccess(response?.message || 'Vous avez rejoint le salon');
                const salonId = response?.data?.salon_id;
                await fetchSalons();
                if (salonId) openSalon({ id: salonId });
            } catch (error) {
                if (error.code === 'pas_encore_ouvert') setOpeningMessage(error.message);
                else showError(error.message);
            }
        })();
        // Une seule fois à l'ouverture de la page.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const timer = setTimeout(fetchSalons, searchTerm ? 350 : 0);
        return () => clearTimeout(timer);
    }, [fetchSalons, searchTerm]);

    useEffect(() => {
        fetchNotifications();
        // En quittant la page, les salons affichés ne sont plus « nouveaux ».
        return () => { salonsAPI.markSalonsSeen().catch(() => {}); };
    }, [fetchNotifications]);

    useEffect(() => {
        const query = searchTerm.trim();
        if (query.length < 2) return undefined;
        const timer = setTimeout(() => addLocalHistoryItem({
            type: 'search',
            title: query,
            description: 'Recherche effectuée dans les salons',
            url: '/salons',
            icon: 'search',
            metadata: { query: `salons:${query}` }
        }), 450);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Rafraîchissement de secours : rapide sans WebSocket, lent avec.
    useEffect(() => {
        const interval = setInterval(() => {
            if (document.hidden) return;
            fetchSalons();
            fetchNotifications();
        }, connected ? POLL_LIST_CONNECTED_MS : POLL_LIST_MS);
        return () => clearInterval(interval);
    }, [connected, fetchSalons, fetchNotifications]);

    useEffect(() => {
        if (connected || !selectedId || !isMember) return undefined;
        const interval = setInterval(() => {
            if (!document.hidden && lastMessageId) fetchNewMessages(selectedId, lastMessageId);
        }, POLL_MESSAGES_MS);
        return () => clearInterval(interval);
    }, [connected, selectedId, isMember, lastMessageId, fetchNewMessages]);

    useEffect(() => {
        if (stickToBottomRef.current) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages]);

    useEffect(() => {
        const timer = setInterval(() => {
            setTyping((t) => {
                const now = Date.now();
                const kept = Object.fromEntries(Object.entries(t).filter(([, v]) => v.until > now));
                return Object.keys(kept).length === Object.keys(t).length ? t : kept;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const typingNames = useMemo(() => Object.values(typing).map((t) => t.name), [typing]);

    // ---------------------------------------------------------------- actions salon

    const run = async (action, success) => {
        try {
            setSubmitting(true);
            const result = await action();
            if (success) showSuccess(typeof success === 'function' ? success(result) : success);
            return result ?? true;
        } catch (error) {
            if (error.code === 'pas_encore_ouvert') setOpeningMessage(error.message);
            else showError(error.message);
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    const openSalon = async (salon) => {
        selectedIdRef.current = salon.id;
        setSelectedSalon(salon);
        setMessages([]);
        setMembers([]);
        setRequests([]);
        setInvites([]);
        setReplyTo(null);
        setTyping({});
        setMessageSearch(null);
        setReports(null);
        setEditing(false);
        setShowResourceForm(false);
        try {
            setDetailLoading(true);
            const detail = await fetchDetail(salon.id);
            addLocalHistoryItem({
                type: 'salon',
                title: detail?.titre || 'Salon ouvert',
                description: detail?.description || 'Discussion consultée',
                url: '/salons',
                icon: 'salon',
                metadata: { salonId: salon.id }
            });
            if (isNotYetOpen(detail)) {
                setOpeningMessage(`Ce salon ouvre le ${formatOuverture(detail.date_ouverture)}. Revenez à ce moment-là.`);
            }
            if (detail?.est_membre || detail?.est_createur) fetchMembers(salon.id);
            if (detail?.est_membre) {
                await fetchLatestMessages(salon.id);
                // Le serveur a aussi marqué les notifications de ce salon comme lues.
                fetchNotifications();
            }
        } catch (error) {
            showError(error.message);
        } finally {
            setDetailLoading(false);
        }
    };

    const createSalon = async (form) => {
        const formData = buildResourcesFormData(form);
        formData.append('titre', form.titre.trim());
        formData.append('description', form.description.trim());
        formData.append('visibilite', form.visibilite);
        if (form.ouverture) formData.append('date_ouverture', new Date(form.ouverture).toISOString());
        const response = await run(() => salonsAPI.createSalon(formData), 'Salon créé avec succès.');
        if (!response) return false;
        setShowCreateForm(false);
        await fetchSalons();
        if (response.data?.id) openSalon(response.data);
        return true;
    };

    const updateSalon = async (form) => {
        const response = await run(() => salonsAPI.updateSalon(selectedId, {
            titre: form.titre.trim(),
            description: form.description.trim(),
            visibilite: form.visibilite,
            date_ouverture: form.ouverture ? new Date(form.ouverture).toISOString() : null
        }), 'Salon modifié avec succès.');
        if (response) {
            setEditing(false);
            setSelectedSalon(response.data);
            fetchSalons();
        }
    };

    const toggleClosed = async () => {
        const closing = !selectedSalon?.ferme;
        if (closing && !window.confirm(
            `Fermer le salon « ${selectedSalon?.titre} » ?\n\nLes membres pourront encore relire les messages et ouvrir les fichiers, `
            + 'mais plus personne ne pourra écrire ni rejoindre le salon. Vous pourrez le rouvrir.'
        )) return;
        const response = await run(
            () => (closing ? salonsAPI.closeSalon(selectedId) : salonsAPI.reopenSalon(selectedId)),
            (r) => r.message
        );
        if (response) {
            setSelectedSalon((previous) => ({ ...previous, ...response.data }));
            setReplyTo(null);
            setEditing(false);
            setShowResourceForm(false);
            fetchSalons();
        }
    };

    const deleteSalon = async () => {
        if (!window.confirm(`Supprimer le salon « ${selectedSalon?.titre} » ?`)) return;
        if (await run(() => salonsAPI.deleteSalon(selectedId), 'Salon supprimé.')) {
            setSelectedSalon(null);
            setMessages([]);
            fetchSalons();
        }
    };

    const joinSalon = async () => {
        const response = await run(() => salonsAPI.joinSalon(selectedId), (r) => r.message);
        if (response) {
            await openSalon({ ...selectedSalon });
            fetchSalons();
        }
    };

    const quitSalon = async () => {
        if (!window.confirm('Quitter ce salon ?')) return;
        if (await run(() => salonsAPI.quitSalon(selectedId))) {
            showInfo(selectedSalon.statut_membre === 'en_attente' ? 'Demande annulée.' : 'Vous avez quitté le salon.');
            setMessages([]);
            setMembers([]);
            await fetchDetail(selectedId);
            fetchSalons();
        }
    };

    const addResources = async (form) => {
        if (!await run(() => salonsAPI.addRessources(selectedId, buildResourcesFormData(form)), 'Ressources ajoutées.')) return false;
        setShowResourceForm(false);
        fetchDetail(selectedId);
        return true;
    };

    const removeResource = async (ressource) => {
        if (!window.confirm(`Retirer la ressource « ${ressource.titre || 'sans titre'} » ?`)) return;
        if (await run(() => salonsAPI.deleteRessource(selectedId, ressource.id), 'Ressource retirée.')) fetchDetail(selectedId);
    };

    const memberAction = async (userId, action) => {
        if (userId && action) {
            if (!await run(() => salonsAPI.memberAction(selectedId, userId, action), (r) => r.message)) return;
        }
        fetchMembers(selectedId);
        fetchDetail(selectedId);
    };

    // ---------------------------------------------------------------- actions messages

    const sendMessage = async ({ text, files, shared }) => {
        let payload;
        if (files.length) {
            payload = new FormData();
            if (text) payload.append('contenu', text);
            files.forEach((file) => payload.append('pieces_jointes', file));
            if (replyTo) payload.append('reponse_a', replyTo.id);
            if (shared) payload.append('ressource_partagee', JSON.stringify(shared));
        } else {
            payload = { contenu: text };
            if (replyTo) payload.reponse_a = replyTo.id;
            if (shared) payload.ressource_partagee = shared;
        }
        try {
            setSending(true);
            const response = await salonsAPI.sendMessage(selectedId, payload);
            stickToBottomRef.current = true;
            if (response?.data) upsertMessage(response.data);
            setReplyTo(null);
            return true;
        } catch (error) {
            showError(error.status === 429 ? 'Vous envoyez trop de messages. Patientez un instant.' : error.message);
            return false;
        } finally {
            setSending(false);
        }
    };

    const editMessage = async (message, contenu) => {
        try {
            const response = await salonsAPI.editMessage(selectedId, message.id, contenu);
            if (response?.data) setMessages((list) => list.map((m) => (m.id === message.id ? response.data : m)));
            return true;
        } catch (error) {
            showError(error.message);
            return false;
        }
    };

    const deleteMessage = async (message) => {
        if (!window.confirm('Supprimer ce message ?')) return;
        try {
            await salonsAPI.deleteMessage(selectedId, message.id);
            setMessages((list) => list.map((m) => (
                m.id === message.id ? { ...m, supprime: true, contenu: '', pieces_jointes: [], image_url: null, ressource_partagee: null, epingle: false } : m
            )));
        } catch (error) {
            showError(error.message);
        }
    };

    const pinMessage = async (message) => {
        try {
            await salonsAPI.pinMessage(selectedId, message.id, !message.epingle);
            setMessages((list) => list.map((m) => (m.id === message.id ? { ...m, epingle: !message.epingle } : m)));
            fetchDetail(selectedId);
        } catch (error) {
            showError(error.message);
        }
    };

    const reportMessage = async (message) => {
        const motif = window.prompt('Pourquoi signalez-vous ce message ? (facultatif)', '');
        if (motif === null) return;
        await run(() => salonsAPI.reportMessage(selectedId, message.id, motif), (r) => r.message);
    };

    const openReports = async () => {
        const response = await run(() => salonsAPI.getReports(selectedId));
        if (response) setReports(extractList(response));
    };

    const resolveReport = async (report) => {
        if (await run(() => salonsAPI.resolveReport(selectedId, report.id))) {
            setReports((list) => list.filter((r) => r.id !== report.id));
        }
    };

    const deleteReportedMessage = async (report) => {
        if (!window.confirm('Supprimer ce message signalé ?')) return;
        if (await run(() => salonsAPI.deleteMessage(selectedId, report.message.id), 'Message supprimé.')) {
            await salonsAPI.resolveReport(selectedId, report.id).catch(() => {});
            setReports((list) => list.filter((r) => r.id !== report.id));
            setMessages((list) => list.map((m) => (m.id === report.message.id ? { ...m, supprime: true, contenu: '' } : m)));
        }
    };

    const jumpTo = async (messageId) => {
        stickToBottomRef.current = false;
        let loaded = messages;
        for (let page = 0; page < 10 && !loaded.some((m) => m.id === messageId); page += 1) {
            if (!loaded.length) break;
            const response = await salonsAPI.getMessages(selectedId, { beforeId: loaded[0].id, limit: 100 });
            const older = extractList(response);
            if (!older.length) break;
            loaded = [...older, ...loaded];
            setHasMore(!!response?.has_more);
        }
        setMessages(loaded);
        setHighlightId(messageId);
        setTimeout(() => document.getElementById(`salon-message-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        setTimeout(() => setHighlightId(null), 2500);
    };

    useEffect(() => {
        if (messageSearch === null || !selectedId) return undefined;
        const query = messageSearch.trim();
        if (query.length < 2) {
            setSearchResults([]);
            return undefined;
        }
        const timer = setTimeout(async () => {
            try {
                setSearchResults(extractList(await salonsAPI.getMessages(selectedId, { search: query, limit: 30 })));
            } catch (error) {
                showError(error.message);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [messageSearch, selectedId, showError]);

    // ---------------------------------------------------------------- notifications

    const openNotification = async (notification) => {
        setShowNotifications(false);
        if (!notification.lu) {
            salonsAPI.markNotificationRead(notification.id).catch(() => {});
            setUnreadNotifications((n) => Math.max(0, n - 1));
            setNotifications((list) => list.map((n) => (n.id === notification.id ? { ...n, lu: true } : n)));
        }
        const salon = salons.find((s) => s.id === notification.salon_id) || { id: notification.salon_id, titre: notification.salon_titre };
        openSalon(salon);
    };

    const markAllNotificationsRead = async () => {
        try {
            await salonsAPI.markNotificationsRead();
            setUnreadNotifications(0);
            setNotifications((list) => list.map((n) => ({ ...n, lu: true })));
        } catch (error) {
            showError(error.message);
        }
    };

    // ---------------------------------------------------------------- rendu

    const renderResource = (ressource) => {
        const icon = ressource.type === 'image' ? <FaImage /> : ressource.type === 'lien' ? <FaLink /> : <FaFileAlt />;
        return (
            <span className="salon-resource-wrapper" key={ressource.id}>
                <a className="salon-resource-item" href={ressource.url || '#'} target="_blank" rel="noopener noreferrer">
                    {icon}
                    <span>{ressource.titre || ressource.url || 'Ressource'}</span>
                </a>
                {isCreator && !isClosed && (
                    <button type="button" className="salon-resource-remove" title="Retirer" onClick={() => removeResource(ressource)}>
                        <FaTimes />
                    </button>
                )}
            </span>
        );
    };

    const ressources = selectedSalon?.ressources || [];
    const pinned = selectedSalon?.messages_epingles || [];

    return (
        <div className="salons-page">
            <ToastContainer toasts={toasts} onClose={removeToast} />
            <OpeningPopup message={openingMessage} onClose={closeOpeningPopup} />
            <AppNavigation />

            <main className={`salons-main with-members${selectedSalon ? '' : ' no-members'}`}>
                <div className="salons-page-toolbar">
                    <span className={`salon-live-status ${connected ? 'on' : 'off'}`} title={connected ? 'Mises à jour en direct' : 'Mises à jour périodiques'}>
                        {connected ? 'En direct' : 'Hors ligne direct'}
                    </span>
                    <button className="salons-notification-btn" onClick={() => setShowNotifications((v) => !v)} aria-label="Notifications des salons">
                        <FaBell />
                        <span>{unreadNotifications}</span>
                    </button>
                    {showNotifications && (
                        <div className="salon-notifications-dropdown">
                            <div className="salon-share-header">
                                <strong>Notifications</strong>
                                <button type="button" onClick={markAllNotificationsRead}>Tout marquer comme lu</button>
                            </div>
                            {notifications.length === 0 && <span className="salons-muted">Aucune notification</span>}
                            {notifications.map((notification) => (
                                <button
                                    type="button"
                                    key={notification.id}
                                    className={`salon-notification-item ${notification.lu ? '' : 'unread'}`}
                                    onClick={() => openNotification(notification)}
                                >
                                    <span>{notification.message}</span>
                                    <small>{formatShortDate(notification.date_creation)}</small>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <aside className="salons-list-panel">
                    <SalonList
                        salons={salons}
                        loading={loading}
                        selectedId={selectedId}
                        searchTerm={searchTerm}
                        onSearch={setSearchTerm}
                        filter={filter}
                        onFilter={setFilter}
                        closedCount={closedCount}
                        showCreateForm={showCreateForm}
                        onToggleCreate={() => setShowCreateForm((v) => !v)}
                        onCreate={createSalon}
                        onError={showError}
                        submitting={submitting}
                        onSelect={openSalon}
                    />
                </aside>


                <section className="salons-detail-panel">
                    {!selectedSalon && (
                        <div className="salons-detail-empty">
                            <FaUsers />
                            <h2>Sélectionnez un salon</h2>
                            <p>Choisissez un salon dans la liste pour voir ses ressources et participer aux messages.</p>
                        </div>
                    )}

                    {selectedSalon && (
                        <>
                            <div className="salon-detail-header">
                                {editing ? (
                                    <EditSalonForm
                                        salon={selectedSalon}
                                        submitting={submitting}
                                        onSubmit={updateSalon}
                                        onCancel={() => setEditing(false)}
                                    />
                                ) : (
                                    <div className="salon-conversation-title">
                                        <h2>Messages</h2>
                                        <p>
                                            {selectedSalon.titre}
                                            <VisibilityBadge salon={selectedSalon} />
                                            {isClosed && <span className="salon-badge salon-badge-closed">Fermé</span>}
                                        </p>
                                        <span>
                                            <FaUsers />
                                            {selectedSalon.membres_count || 0} participant(s)
                                            {selectedSalon.statut_membre && !isMember && ` · ${STATUT_LABELS[selectedSalon.statut_membre] || ''}`}
                                        </span>
                                    </div>
                                )}

                                <div className="salon-detail-actions">
                                    {isMember && (
                                        <button className="salons-secondary-btn" onClick={() => setMessageSearch((v) => (v === null ? '' : null))}>
                                            <FaSearch />
                                            Rechercher
                                        </button>
                                    )}
                                    <button className="salons-secondary-btn" onClick={() => showInfo(selectedSalon.description || 'Aucune description disponible.')}>
                                        <FaInfoCircle />
                                        Infos
                                    </button>
                                    {!isMember && !isCreator && !isClosed && selectedSalon.statut_membre !== 'en_attente' && (
                                        <button className="salons-primary-btn" onClick={joinSalon} disabled={submitting}>
                                            <FaUsers />
                                            {selectedSalon.statut_membre === 'invite'
                                                ? "Accepter l'invitation"
                                                : selectedSalon.visibilite === 'prive' ? 'Demander à rejoindre' : 'Rejoindre'}
                                        </button>
                                    )}
                                    {!isCreator && (isMember || selectedSalon.statut_membre === 'en_attente') && (
                                        <button className="salons-secondary-btn" onClick={quitSalon} disabled={submitting}>
                                            <FaSignOutAlt />
                                            {isMember ? 'Quitter' : 'Annuler la demande'}
                                        </button>
                                    )}
                                    {isCreator && (
                                        <>
                                            <button className="salons-secondary-btn" onClick={toggleClosed} disabled={submitting}>
                                                {isClosed ? <FaLockOpen /> : <FaLock />}
                                                {isClosed ? 'Rouvrir' : 'Fermer'}
                                            </button>
                                            {!isClosed && (
                                            <>
                                            <button className="salons-secondary-btn" onClick={() => setEditing(true)}>
                                                <FaEdit />
                                                Modifier
                                            </button>
                                            <button className="salons-secondary-btn" onClick={() => setShowResourceForm((v) => !v)} disabled={ressources.length >= MAX_RESOURCES}>
                                                <FaPlus />
                                                Ressources
                                            </button>
                                            </>
                                            )}
                                            <button className="salons-secondary-btn" onClick={openReports}>
                                                <FaFlag />
                                                Signalements
                                            </button>
                                            <button className="salons-danger-btn" onClick={deleteSalon} disabled={submitting} aria-label="Supprimer le salon">
                                                <FaTrash />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {detailLoading && <div className="salons-empty-state">Chargement du détail…</div>}

                            {selectedSalon.est_ouvert === false && (
                                <div className="salon-closed-banner salon-opening-banner" role="status">
                                    <FaClock />
                                    <span>
                                        Ouverture le {formatOuverture(selectedSalon.date_ouverture)} (heure de Kinshasa).
                                        {isCreator
                                            ? " D'ici là, vous seul pouvez entrer pour préparer le salon."
                                            : " Personne ne peut entrer avant cette heure, même avec un lien d'invitation."}
                                    </span>
                                </div>
                            )}

                            {isClosed && (
                                <div className="salon-closed-banner" role="status">
                                    <FaLock />
                                    <span>
                                        Ce salon est fermé{selectedSalon.date_fermeture ? ` depuis le ${new Date(selectedSalon.date_fermeture).toLocaleDateString('fr-FR')}` : ''} :
                                        {' '}les messages et les fichiers restent consultables, mais plus personne ne peut écrire.
                                        {isCreator && ' Vous pouvez le rouvrir ou le supprimer.'}
                                    </span>
                                </div>
                            )}

                            {showResourceForm && isCreator && !isClosed && (
                                <AddResourcesForm
                                    existing={ressources.length}
                                    submitting={submitting}
                                    onSubmit={addResources}
                                    onError={showError}
                                />
                            )}

                            {reports && (
                                <ReportsPanel
                                    reports={reports}
                                    onResolve={resolveReport}
                                    onDeleteMessage={deleteReportedMessage}
                                    onClose={() => setReports(null)}
                                />
                            )}

                            <div className="salon-detail-grid salon-detail-grid-single">
                                <div className="salon-resources-section">
                                    <h3>Ressources</h3>
                                    <div className="salon-resources-list">
                                        {ressources.length > 0
                                            ? ressources.map(renderResource)
                                            : (
                                                <span className="salons-muted">
                                                    {selectedSalon.visibilite === 'prive' && !isMember
                                                        ? 'Ressources réservées aux membres'
                                                        : 'Aucune ressource affichée'}
                                                </span>
                                            )}
                                    </div>
                                </div>
                            </div>

                            {isMember && pinned.length > 0 && (
                                <div className="salon-pinned-bar">
                                    <FaThumbtack />
                                    {pinned.map((message) => (
                                        <button type="button" key={message.id} onClick={() => jumpTo(message.id)}>
                                            <strong>{personName(message.expediteur)}</strong> : {(message.contenu || message.ressource_partagee?.titre || 'Pièce jointe').slice(0, 80)}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {isMember && messageSearch !== null && (
                                <div className="salon-message-search">
                                    <input
                                        type="search"
                                        autoFocus
                                        value={messageSearch}
                                        onChange={(event) => setMessageSearch(event.target.value)}
                                        placeholder="Rechercher dans les messages de ce salon"
                                    />
                                    {searchResults.map((message) => (
                                        <button type="button" key={message.id} onClick={() => jumpTo(message.id)}>
                                            <strong>{personName(message.expediteur)}</strong>
                                            <span>{message.contenu.slice(0, 120)}</span>
                                            <small>{formatShortDate(message.date_envoi)}</small>
                                        </button>
                                    ))}
                                    {messageSearch.trim().length >= 2 && searchResults.length === 0 && (
                                        <span className="salons-muted">Aucun message trouvé</span>
                                    )}
                                </div>
                            )}

                            <div className="salon-messages-section">
                                {!isMember && (
                                    <div className="salons-empty-state">
                                        {selectedSalon.statut_membre === 'en_attente'
                                            ? 'Votre demande est en attente de validation par le créateur du salon.'
                                            : selectedSalon.statut_membre === 'retire'
                                                ? 'Le créateur vous a retiré de ce salon.'
                                                : isClosed
                                                    ? 'Ce salon est fermé : il ne peut plus être rejoint.'
                                                    : isNotYetOpen(selectedSalon)
                                                        ? `Ce salon ouvre le ${formatOuverture(selectedSalon.date_ouverture)}.`
                                                    : 'Rejoignez ce salon pour consulter et envoyer des messages.'}
                                    </div>
                                )}

                                {isMember && (
                                    <>
                                        <MessageList
                                            messages={messages}
                                            loading={messagesLoading}
                                            hasMore={hasMore}
                                            loadingMore={loadingMore}
                                            onLoadMore={loadOlder}
                                            currentUserId={currentUserId}
                                            isCreator={isCreator}
                                            readOnly={isClosed}
                                            typingNames={typingNames}
                                            highlightId={highlightId}
                                            endRef={messagesEndRef}
                                            onReply={setReplyTo}
                                            onEdit={editMessage}
                                            onDelete={deleteMessage}
                                            onPin={pinMessage}
                                            onReport={reportMessage}
                                        />
                                        {!isClosed && (
                                        <MessageComposer
                                            members={members}
                                            replyTo={replyTo}
                                            onCancelReply={() => setReplyTo(null)}
                                            onSend={sendMessage}
                                            onTyping={() => sendTyping(selectedId)}
                                            onError={showError}
                                            sending={sending}
                                        />
                                        )}
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </section>

                {/* Membres du salon : colonne à droite, à l'opposé de la liste des salons.
                    Masquée tant qu'aucun salon n'est sélectionné. */}
                {selectedSalon && (
                <aside className="salons-members-panel">
                    <MembersPanel
                        salon={selectedSalon}
                        members={members}
                        requests={requests}
                        invites={invites}
                        isCreator={isCreator}
                        onAction={memberAction}
                        onInfo={showSuccess}
                        onError={showError}
                    />
                </aside>
                )}
            </main>
        </div>
    );
};

export default SalonsPage;
