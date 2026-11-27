import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaArrowLeft,
    FaBell,
    FaChevronDown,
    FaChevronRight,
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
    FaUsers,
    FaVideo
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
import { ActionsMenu, ConfirmDialog, SalonsWelcome } from './salons/SalonUi';
import useDialogs from './salons/useDialogs';
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

// LiveKit n'est téléchargé qu'à l'entrée dans une réunion.
const MeetingRoom = lazy(() => import('./salons/MeetingRoom'));

const POLL_MESSAGES_MS = 7000;
const POLL_LIST_MS = 30000;
const POLL_LIST_CONNECTED_MS = 120000;
const TYPING_TTL_MS = 4000;

const SalonsPage = () => {
    const navigate = useNavigate();
    const currentUser = getCurrentUser();
    const currentUserId = currentUser?.id ?? currentUser?.user?.id ?? null;
    const { toasts, removeToast, showError, showSuccess, showInfo } = useToast();
    const { confirm, prompt, dialog } = useDialogs();

    const [salons, setSalons] = useState([]);
    const [filter, setFilter] = useState('mes_salons');
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
    // Téléphone : un seul écran à la fois (liste des salons, salon, membres).
    const [mobileView, setMobileView] = useState('list');
    const [showAbout, setShowAbout] = useState(false);
    const [showResources, setShowResources] = useState(false);
    const [showPinned, setShowPinned] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [firstUnreadId, setFirstUnreadId] = useState(null);
    // Réunion vidéo du salon affiché : état serveur, fenêtre ouverte, jeton d'entrée.
    const [reunion, setReunion] = useState(null);
    const [reunionCanEnd, setReunionCanEnd] = useState(false);
    const [meetingOpen, setMeetingOpen] = useState(false);
    const [meetingSession, setMeetingSession] = useState(null);
    const messagesContainerRef = useRef(null);
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
            const list = extractList(response);
            setMessages(list);
            setHasMore(!!response?.has_more);
            // Le serveur a marqué le salon comme lu : on remet le compteur à zéro ici aussi.
            setSalons((items) => items.map((s) => (s.id === salonId ? { ...s, non_lus_count: 0 } : s)));
            return list;
        } catch (error) {
            showError(error.message);
            return [];
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
            case 'presence.changed':
                if (payload.salon_id === current) {
                    setMembers((list) => list.map((m) => (
                        m.utilisateur?.id === payload.user_id ? { ...m, en_ligne: payload.en_ligne } : m
                    )));
                }
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
            case 'reunion.updated':
                setSalons((list) => list.map((s) => (
                    s.id === payload.salon_id ? { ...s, reunion_en_cours: !!payload.reunion } : s
                )));
                if (payload.salon_id === current) {
                    setReunion(payload.reunion || null);
                    setSelectedSalon((previous) => (previous ? { ...previous, reunion_en_cours: !!payload.reunion } : previous));
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

    // Seule la zone des messages défile (la page et la barre d'écriture restent en place).
    useEffect(() => {
        const el = messagesContainerRef.current;
        if (!el || !stickToBottomRef.current) return;
        const separator = firstUnreadId && el.querySelector('.salon-unread-separator');
        if (separator) {
            el.scrollTop = Math.max(0, separator.offsetTop - 24);
            stickToBottomRef.current = false;
        } else {
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }
    }, [messages, firstUnreadId]);

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
        const unreadBefore = salon.non_lus_count || salons.find((s) => s.id === salon.id)?.non_lus_count || 0;
        selectedIdRef.current = salon.id;
        setSelectedSalon(salon);
        setMobileView('salon');
        setShowAbout(false);
        setShowResources(false);
        setShowPinned(false);
        setFirstUnreadId(null);
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
                const list = await fetchLatestMessages(salon.id);
                // Ligne « Nouveaux messages » avant le premier message non lu.
                if (unreadBefore > 0 && list.length > 0) {
                    setFirstUnreadId(list[Math.max(0, list.length - unreadBefore)].id);
                }
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

    // ---------------------------------------------------------------- réunion vidéo

    const canMeet = isMember && !isClosed && selectedSalon?.est_ouvert !== false;

    useEffect(() => {
        setReunion(null);
        setReunionCanEnd(false);
        if (!selectedId || !isMember) return undefined;
        let cancelled = false;
        salonsAPI.getReunion(selectedId).then((response) => {
            if (cancelled) return;
            setReunion(response?.data?.reunion || null);
            setReunionCanEnd(!!response?.data?.peut_terminer);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [selectedId, isMember, selectedSalon?.reunion_en_cours]);

    // Changer de salon (ou salon supprimé) ferme la fenêtre de réunion de l'ancien salon.
    useEffect(() => {
        setMeetingOpen(false);
        setMeetingSession(null);
    }, [selectedId]);

    const openMeeting = () => {
        setMeetingSession(null);
        setMeetingOpen(true);
    };

    const requestMeetingToken = async () => {
        try {
            const response = await salonsAPI.joinReunion(selectedId);
            setMeetingSession(response.data);
            setReunion(response.data?.reunion || null);
            setReunionCanEnd(!!response.data?.peut_terminer);
            return response.data;
        } catch (error) {
            showError(error.message);
            throw error;
        }
    };

    const closeMeeting = useCallback(() => {
        setMeetingOpen(false);
        setMeetingSession(null);
    }, []);

    const endMeetingForAll = async () => {
        if (!await confirm({
            title: 'Terminer la réunion pour tous ?',
            message: 'Tous les participants seront déconnectés de la réunion.',
            confirmLabel: 'Terminer la réunion',
            danger: true
        })) return;
        try {
            await salonsAPI.endReunion(selectedId);
            setReunion(null);
            closeMeeting();
            showSuccess('Réunion terminée');
        } catch (error) {
            showError(error.message);
        }
    };

    const toggleClosed = async () => {
        const closing = !selectedSalon?.ferme;
        if (closing && !await confirm({
            title: 'Fermer le salon ?',
            message: `Les membres de « ${selectedSalon?.titre} » pourront encore relire les messages et ouvrir les fichiers, `
                + 'mais plus personne ne pourra écrire ni rejoindre le salon. Vous pourrez le rouvrir.',
            confirmLabel: 'Fermer le salon'
        })) return;
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
        if (await run(() => salonsAPI.deleteSalon(selectedId), 'Salon supprimé.')) {
            setConfirmDelete(false);
            setSelectedSalon(null);
            setMessages([]);
            setMobileView('list');
            fetchSalons();
        }
    };

    // Rejoindre un salon en collant un lien d'invitation reçu.
    const joinWithLink = async () => {
        const input = await prompt({
            title: 'Rejoindre avec un lien',
            label: "Collez le lien d'invitation reçu :",
            placeholder: 'https://bnn.minesursi.gouv.cd/salons?invitation=…',
            confirmLabel: 'Rejoindre',
            required: true
        });
        if (!input) return;
        const match = input.match(/[?&]invitation=([^\s&#]+)/);
        const token = match ? decodeURIComponent(match[1]) : (/^\S+$/.test(input.trim()) && !input.includes('://') ? input.trim() : null);
        if (!token) {
            showError("Ce lien d'invitation n'est pas valide.");
            return;
        }
        const response = await run(() => salonsAPI.joinByInvitation(token), (r) => r?.message || 'Vous avez rejoint le salon');
        if (response?.data?.salon_id) {
            await fetchSalons();
            openSalon({ id: response.data.salon_id });
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
        const pending = selectedSalon?.statut_membre === 'en_attente';
        if (!await confirm({
            title: pending ? 'Annuler la demande ?' : 'Quitter le salon ?',
            message: pending
                ? `Votre demande pour rejoindre « ${selectedSalon?.titre} » sera annulée.`
                : `Vous ne recevrez plus les messages de « ${selectedSalon?.titre} ». Vous pourrez le rejoindre à nouveau plus tard.`,
            confirmLabel: pending ? 'Annuler la demande' : 'Quitter',
            danger: !pending
        })) return;
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
        if (!await confirm({
            title: 'Retirer la ressource ?',
            message: `« ${ressource.titre || 'sans titre'} » ne sera plus visible dans le salon.`,
            confirmLabel: 'Retirer',
            danger: true
        })) return;
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
        if (!await confirm({
            title: 'Supprimer le message ?',
            message: 'Le message sera remplacé par « Message supprimé » pour tous les membres.',
            confirmLabel: 'Supprimer',
            danger: true
        })) return;
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

    const reactToMessage = async (message, emoji) => {
        try {
            const response = await salonsAPI.reactToMessage(selectedId, message.id, emoji);
            stickToBottomRef.current = false;
            if (response?.data) setMessages((list) => list.map((m) => (m.id === message.id ? response.data : m)));
        } catch (error) {
            showError(error.message);
        }
    };

    const reportMessage = async (message) => {
        const motif = await prompt({
            title: 'Signaler le message',
            message: 'Le créateur du salon recevra votre signalement.',
            label: 'Pourquoi signalez-vous ce message ? (facultatif)',
            multiline: true,
            confirmLabel: 'Signaler',
            danger: true
        });
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
        if (!await confirm({
            title: 'Supprimer le message signalé ?',
            message: 'Le message sera supprimé pour tous les membres et le signalement sera traité.',
            confirmLabel: 'Supprimer',
            danger: true
        })) return;
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
    const canSeeContent = isMember || isCreator;

    // Actions secondaires de l'en-tête, regroupées dans le menu « ⋯ ».
    const menuItems = [
        isCreator && !isClosed && { label: 'Modifier le salon', icon: <FaEdit />, onClick: () => setEditing(true) },
        isCreator && !isClosed && {
            label: 'Ajouter des ressources',
            icon: <FaPlus />,
            disabled: ressources.length >= MAX_RESOURCES,
            onClick: () => { setShowResourceForm(true); setShowResources(true); }
        },
        isCreator && { label: 'Signalements', icon: <FaFlag />, onClick: openReports },
        isCreator && { label: isClosed ? 'Rouvrir le salon' : 'Fermer le salon', icon: isClosed ? <FaLockOpen /> : <FaLock />, onClick: toggleClosed },
        !isCreator && (isMember || selectedSalon?.statut_membre === 'en_attente') && {
            label: isMember ? 'Quitter le salon' : 'Annuler la demande',
            icon: <FaSignOutAlt />,
            onClick: quitSalon
        },
        isCreator && { label: 'Supprimer le salon', icon: <FaTrash />, danger: true, onClick: () => setConfirmDelete(true) }
    ];

    return (
        <div className="salons-page">
            <ToastContainer toasts={toasts} onClose={removeToast} />
            {dialog}
            {meetingOpen && selectedSalon && (
                <Suspense fallback={<div className="salon-meeting-loading" role="status">Préparation de la réunion…</div>}>
                    <MeetingRoom
                        salon={selectedSalon}
                        session={meetingSession}
                        starting={!reunion}
                        onRequestJoin={requestMeetingToken}
                        onClose={closeMeeting}
                        onEndForAll={endMeetingForAll}
                        notify={showInfo}
                        onError={showError}
                    />
                </Suspense>
            )}
            <OpeningPopup message={openingMessage} onClose={closeOpeningPopup} />
            <ConfirmDialog
                open={confirmDelete}
                title="Supprimer le salon ?"
                confirmLabel="Supprimer définitivement"
                busy={submitting}
                onConfirm={deleteSalon}
                onCancel={() => setConfirmDelete(false)}
            >
                <p>
                    Le salon <strong>« {selectedSalon?.titre} »</strong> sera supprimé pour tous ses membres,
                    avec ses messages, ses fichiers et ses ressources.
                </p>
                <p className="salon-dialog-warning">Cette action est définitive. Pour garder les messages en lecture seule, fermez plutôt le salon.</p>
            </ConfirmDialog>
            <AppNavigation />

            <main className={`salons-main with-members${selectedSalon ? '' : ' no-members'} mobile-${selectedSalon ? mobileView : 'list'}`}>
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
                        currentUserId={currentUserId}
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
                        <SalonsWelcome
                            salons={salons}
                            onCreate={() => setShowCreateForm(true)}
                            onJoinWithLink={joinWithLink}
                            onOpen={openSalon}
                        />
                    )}

                    {selectedSalon && (
                        <>
                            <div className="salon-detail-header">
                                <button type="button" className="salon-mobile-back" onClick={() => setMobileView('list')} aria-label="Retour à la liste des salons">
                                    <FaArrowLeft /> Salons
                                </button>
                                {editing ? (
                                    <EditSalonForm
                                        salon={selectedSalon}
                                        submitting={submitting}
                                        onSubmit={updateSalon}
                                        onCancel={() => setEditing(false)}
                                    />
                                ) : (
                                    <div className="salon-conversation-title">
                                        <h2>{selectedSalon.titre}</h2>
                                        <p>
                                            <VisibilityBadge salon={selectedSalon} />
                                            {isClosed && <span className="salon-badge salon-badge-closed">Fermé</span>}
                                            <span className="salon-title-meta">
                                                <FaUsers />
                                                {selectedSalon.membres_count || 0} participant(s)
                                                {selectedSalon.statut_membre && !isMember && ` · ${STATUT_LABELS[selectedSalon.statut_membre] || ''}`}
                                            </span>
                                        </p>
                                    </div>
                                )}

                                <div className="salon-detail-actions">
                                    {!isMember && !isCreator && !isClosed && selectedSalon.statut_membre !== 'en_attente' && (
                                        <button className="salons-primary-btn" onClick={joinSalon} disabled={submitting}>
                                            <FaUsers />
                                            {selectedSalon.statut_membre === 'invite'
                                                ? "Accepter l'invitation"
                                                : selectedSalon.visibilite === 'prive' ? 'Demander à rejoindre' : 'Rejoindre'}
                                        </button>
                                    )}
                                    {canMeet && (
                                        <button
                                            className="salons-secondary-btn salon-meeting-btn"
                                            onClick={openMeeting}
                                            title={reunion ? 'Rejoindre la réunion vidéo en cours' : 'Démarrer une réunion vidéo avec les membres'}
                                        >
                                            <FaVideo />
                                            <span className="salon-btn-label">{reunion ? 'Rejoindre la réunion' : 'Démarrer une réunion'}</span>
                                        </button>
                                    )}
                                    {isMember && (
                                        <button
                                            className={`salons-secondary-btn ${messageSearch !== null ? 'active' : ''}`}
                                            onClick={() => setMessageSearch((v) => (v === null ? '' : null))}
                                            title="Rechercher dans les messages"
                                        >
                                            <FaSearch />
                                            <span className="salon-btn-label">Rechercher</span>
                                        </button>
                                    )}
                                    <button
                                        className={`salons-secondary-btn ${showAbout ? 'active' : ''}`}
                                        onClick={() => setShowAbout((v) => !v)}
                                        title="Infos du salon"
                                    >
                                        <FaInfoCircle />
                                        <span className="salon-btn-label">Infos</span>
                                    </button>
                                    <button type="button" className="salons-secondary-btn salon-mobile-members" onClick={() => setMobileView('members')}>
                                        <FaUsers />
                                        <span className="salon-btn-label">Membres</span>
                                    </button>
                                    <ActionsMenu items={menuItems} />
                                </div>
                            </div>

                            {detailLoading && <div className="salons-empty-state">Chargement du détail…</div>}

                            {showAbout && (
                                <div className="salon-about">
                                    <p>{selectedSalon.description || 'Aucune description.'}</p>
                                    <small>
                                        Créé par {personName(selectedSalon.createur)}
                                        {selectedSalon.date_creation && ` le ${new Date(selectedSalon.date_creation).toLocaleDateString('fr-FR')}`}
                                        {selectedSalon.date_ouverture && ` · ouverture le ${formatOuverture(selectedSalon.date_ouverture)}`}
                                    </small>
                                </div>
                            )}

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

                            {isMember && reunion && !meetingOpen && (
                                <div className="salon-meeting-banner" role="status">
                                    <i className="salon-meeting-dot" aria-hidden="true" />
                                    <span>
                                        Réunion en cours
                                        {reunion.lance_par?.nom && ` · lancée par ${reunion.lance_par.nom}`}
                                        {typeof reunion.participants_count === 'number' && ` · ${reunion.participants_count} participant(s)`}
                                    </span>
                                    {canMeet && (
                                        <button type="button" className="salons-primary-btn" onClick={openMeeting}>
                                            <FaVideo /> Rejoindre
                                        </button>
                                    )}
                                    {reunionCanEnd && (
                                        <button type="button" className="salons-secondary-btn" onClick={endMeetingForAll}>
                                            Terminer
                                        </button>
                                    )}
                                </div>
                            )}

                            {isClosed && (
                                <div className="salon-closed-banner" role="status">
                                    <FaLock />
                                    <span>
                                        Ce salon est fermé{selectedSalon.date_fermeture ? ` depuis le ${new Date(selectedSalon.date_fermeture).toLocaleDateString('fr-FR')}` : ''} :
                                        {' '}les messages et les fichiers restent consultables, mais plus personne ne peut écrire.
                                        {isCreator && ' Vous pouvez le rouvrir ou le supprimer depuis le menu « ⋯ ».'}
                                    </span>
                                </div>
                            )}

                            {reports && (
                                <ReportsPanel
                                    reports={reports}
                                    onResolve={resolveReport}
                                    onDeleteMessage={deleteReportedMessage}
                                    onClose={() => setReports(null)}
                                />
                            )}

                            {/* Ressources et messages épinglés : repliés par défaut, on les ouvre au besoin. */}
                            {(ressources.length > 0 || (isMember && pinned.length > 0) || (showResourceForm && isCreator)) && (
                                <div className="salon-collapsibles">
                                    {(ressources.length > 0 || showResourceForm) && (
                                        <button type="button" className="salon-collapsible-toggle" onClick={() => setShowResources((v) => !v)} aria-expanded={showResources}>
                                            {showResources ? <FaChevronDown /> : <FaChevronRight />}
                                            <FaFileAlt /> Ressources ({ressources.length})
                                        </button>
                                    )}
                                    {isMember && pinned.length > 0 && (
                                        <button type="button" className="salon-collapsible-toggle" onClick={() => setShowPinned((v) => !v)} aria-expanded={showPinned}>
                                            {showPinned ? <FaChevronDown /> : <FaChevronRight />}
                                            <FaThumbtack /> {pinned.length} message{pinned.length > 1 ? 's' : ''} épinglé{pinned.length > 1 ? 's' : ''}
                                        </button>
                                    )}
                                </div>
                            )}

                            {showResources && (
                                <div className="salon-resources-section salon-collapsible-body">
                                    <div className="salon-resources-list">
                                        {ressources.length > 0
                                            ? ressources.map(renderResource)
                                            : <span className="salons-muted">Aucune ressource</span>}
                                    </div>
                                    {showResourceForm && isCreator && !isClosed && (
                                        <AddResourcesForm
                                            existing={ressources.length}
                                            submitting={submitting}
                                            onSubmit={addResources}
                                            onError={showError}
                                        />
                                    )}
                                </div>
                            )}

                            {showPinned && isMember && pinned.length > 0 && (
                                <div className="salon-pinned-bar salon-collapsible-body">
                                    {pinned.map((message) => (
                                        <button type="button" key={message.id} onClick={() => jumpTo(message.id)}>
                                            <FaThumbtack />
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
                                    <div className="salons-empty-state salon-not-member">
                                        {!canSeeContent && selectedSalon.description && <p>{selectedSalon.description}</p>}
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
                                            firstUnreadId={firstUnreadId}
                                            endRef={messagesEndRef}
                                            containerRef={messagesContainerRef}
                                            onReply={setReplyTo}
                                            onEdit={editMessage}
                                            onDelete={deleteMessage}
                                            onPin={pinMessage}
                                            onReport={reportMessage}
                                            onReact={reactToMessage}
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
                    Masquée tant qu'aucun salon n'est sélectionné. Sur téléphone : écran à part. */}
                {selectedSalon && (
                <aside className="salons-members-panel">
                    <button type="button" className="salon-mobile-back" onClick={() => setMobileView('salon')}>
                        <FaArrowLeft /> Retour au salon
                    </button>
                    <MembersPanel
                        salon={selectedSalon}
                        members={members}
                        requests={requests}
                        invites={invites}
                        isCreator={isCreator}
                        onAction={memberAction}
                        confirm={confirm}
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
