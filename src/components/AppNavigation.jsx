import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    LuChevronDown,
    LuGlobe,
    LuGraduationCap,
    LuHeart,
    LuHistory,
    LuHouse,
    LuLogOut,
    LuMenu,
    LuMessageCircle,
    LuSettings,
    LuUser,
    LuX
} from 'react-icons/lu';
import { favorisAPI } from '../api';
import { getCurrentUser, logout } from '../utils/auth';
import { getMediaUrl } from '../config';
import logoBlancImg from '../assets/Logoblanc.png';
import { addLocalHistoryItem, getUnseenHistoryCount, markLocalHistorySeen } from '../utils/localHistory';

const getFavorisCountFromResponse = (response) => {
    if (typeof response?.count === 'number') return response.count;
    if (typeof response?.results?.count === 'number') return response.results.count;

    const favorisData = response?.results?.data || response?.results || response?.data || response;
    return Array.isArray(favorisData) ? favorisData.length : 0;
};

const AppNavigation = ({ favoriteCountOverride = null }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const userMenuRef = useRef(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [favoriteCount, setFavoriteCount] = useState(0);
    const [unseenHistoryCount, setUnseenHistoryCount] = useState(0);
    const user = getCurrentUser();

    const displayName = 'Bihango';
    const avatarInitial = displayName[0];
    const visibleFavoriteCount = favoriteCountOverride ?? favoriteCount;

    const fetchFavoriteCount = async () => {
        if (favoriteCountOverride !== null) return;

        try {
            const response = await favorisAPI.getFavoris();
            setFavoriteCount(getFavorisCountFromResponse(response));
        } catch (error) {
            console.warn('Erreur lors du chargement du compteur favoris:', error.message);
            setFavoriteCount(0);
        }
    };

    useEffect(() => {
        const pageTitles = {
            '/home': 'Accueil',
            '/profile': 'Profil',
            '/favoris': 'Favoris',
            '/salons': 'Salons',
            '/historique': 'Historique'
        };

        const pageTitle = pageTitles[location.pathname] || 'Page consultée';
        addLocalHistoryItem({
            type: 'page',
            title: pageTitle,
            description: `Page ouverte: ${pageTitle}`,
            url: location.pathname,
            icon: 'page'
        });

        if (location.pathname === '/historique') {
            setTimeout(markLocalHistorySeen, 0);
        }
    }, [location.pathname]);

    useEffect(() => {
        const refreshUnseenHistory = () => setUnseenHistoryCount(getUnseenHistoryCount());
        refreshUnseenHistory();
        window.addEventListener('local-history:changed', refreshUnseenHistory);
        return () => window.removeEventListener('local-history:changed', refreshUnseenHistory);
    }, []);

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setUserMenuOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setUserMenuOpen(false);
                setMobileMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    useEffect(() => {
        fetchFavoriteCount();

        const handleFavoriteChange = () => fetchFavoriteCount();
        const handlePageShow = () => fetchFavoriteCount();
        const handleVisibilityChange = () => {
            if (!document.hidden) fetchFavoriteCount();
        };

        window.addEventListener('favorites:changed', handleFavoriteChange);
        window.addEventListener('pageshow', handlePageShow);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('favorites:changed', handleFavoriteChange);
            window.removeEventListener('pageshow', handlePageShow);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [favoriteCountOverride]);

    const handleLogout = () => {
        sessionStorage.removeItem('homePageState');
        logout();
        navigate('/login');
    };

    const handleProfileClick = () => {
        setUserMenuOpen(false);
        setMobileMenuOpen(false);
        navigate('/profile');
    };

    const navItems = [
        {
            label: 'Accueil',
            icon: LuHouse,
            isActive: location.pathname === '/home',
            onClick: () => navigate('/home')
        },
        {
            label: 'Favoris',
            icon: LuHeart,
            isActive: location.pathname === '/favoris',
            badge: visibleFavoriteCount,
            onClick: () => navigate('/favoris')
        },
        {
            label: 'Salons',
            icon: LuMessageCircle,
            isActive: location.pathname === '/salons',
            onClick: () => navigate('/salons')
        },
        {
            label: 'Classroom',
            icon: LuGraduationCap,
            isActive: false,
            onClick: () => window.open('https://classroom.cgiibnn-esursi.cd/', '_blank', 'noopener,noreferrer')
        },
        {
            label: 'Portail',
            icon: LuGlobe,
            isActive: false,
            onClick: () => window.open('https://portail.cgiibnn-esursi.cd/', '_blank', 'noopener,noreferrer')
        },
        {
            label: 'Historique',
            icon: LuHistory,
            isActive: location.pathname === '/historique',
            hasPulseBadge: location.pathname !== '/historique' && unseenHistoryCount > 0,
            onClick: () => navigate('/historique')
        }
    ];

    const handleNavClick = (item) => {
        item.onClick();
        setMobileMenuOpen(false);
    };

    return (
        <header className="homepage-header">
            <div className="homepage-header-content">
                <button
                    type="button"
                    className="homepage-brand"
                    onClick={() => navigate('/home')}
                    aria-label="Retour à l'accueil"
                >
                    <img
                        src={logoBlancImg}
                        alt="BNN ESURSI - Plateforme de ressources éducatives"
                        className="homepage-logo"
                    />
                </button>

                <button
                    className="homepage-burger-btn"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                    aria-expanded={mobileMenuOpen}
                >
                    {mobileMenuOpen ? <LuX size={20} /> : <LuMenu size={20} />}
                </button>

                <div className={`homepage-user-actions ${mobileMenuOpen ? 'open' : ''}`} aria-label="Navigation principale">
                    <nav className="homepage-main-nav" aria-label="Menu principal">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.label}
                                    type="button"
                                    className={`homepage-nav-item ${item.isActive ? 'active' : ''}`}
                                    onClick={() => handleNavClick(item)}
                                    aria-current={item.isActive ? 'page' : undefined}
                                >
                                    <span className="homepage-nav-active-indicator" aria-hidden="true" />
                                    <Icon className="homepage-nav-icon" size={17} strokeWidth={1.8} />
                                    <span className="homepage-nav-label">{item.label}</span>
                                    {item.badge > 0 && (
                                        <span
                                            key={item.badge}
                                            className="homepage-nav-badge"
                                            aria-label={`${item.badge} favori${item.badge > 1 ? 's' : ''}`}
                                        >
                                            {item.badge > 99 ? '99+' : item.badge}
                                        </span>
                                    )}
                                    {item.hasPulseBadge && (
                                        <span
                                            className="homepage-nav-pulse-badge"
                                            aria-label="Nouvel historique"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    <div className="homepage-user-menu" ref={userMenuRef}>
                        <button
                            type="button"
                            className="homepage-user-trigger"
                            onClick={() => setUserMenuOpen((open) => !open)}
                            aria-haspopup="menu"
                            aria-expanded={userMenuOpen}
                        >
                            <span className="homepage-user-meta">
                                <span className="homepage-user-name">{displayName}</span>
                                <span className="homepage-user-status-text">Connecté</span>
                            </span>
                            <span className="homepage-user-avatar" title="Voir mon profil">
                                {user?.avatar ? (
                                    <img
                                        src={`${getMediaUrl(user.avatar)}?t=${Date.now()}`}
                                        alt={`Avatar de ${displayName}`}
                                        className="homepage-avatar-img"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                        }}
                                    />
                                ) : null}
                                <span
                                    className="homepage-avatar-placeholder"
                                    style={{ display: user?.avatar ? 'none' : 'flex' }}
                                >
                                    {avatarInitial}
                                </span>
                                <span className="homepage-status-dot" aria-label="Connecté" />
                            </span>
                            <LuChevronDown className={`homepage-user-chevron ${userMenuOpen ? 'open' : ''}`} size={16} strokeWidth={1.8} />
                        </button>

                        {userMenuOpen && (
                            <div className="homepage-user-dropdown" role="menu">
                                <button type="button" role="menuitem" onClick={handleProfileClick}>
                                    <LuUser size={16} strokeWidth={1.8} />
                                    Mon profil
                                </button>
                                <button type="button" role="menuitem" onClick={handleProfileClick}>
                                    <LuSettings size={16} strokeWidth={1.8} />
                                    Paramètres
                                </button>
                                <button type="button" role="menuitem" className="danger" onClick={handleLogout}>
                                    <LuLogOut size={16} strokeWidth={1.8} />
                                    Déconnexion
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {mobileMenuOpen && (
                    <div
                        className="homepage-menu-overlay"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                )}
            </div>
        </header>
    );
};

export default AppNavigation;
