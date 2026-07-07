import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LuBookOpen,
    LuClock,
    LuExternalLink,
    LuHeart,
    LuMessageCircle,
    LuSearch,
    LuSparkles,
    LuTrash2,
    LuX
} from 'react-icons/lu';
import {
    clearLocalHistory,
    getHistoryTypeLabel,
    getLocalHistory,
    removeLocalHistoryItem
} from '../utils/localHistory';

const filters = [
    { value: 'all', label: 'Tout' },
    { value: 'resource', label: 'Ressources' },
    { value: 'favorite', label: 'Favoris' },
    { value: 'salon', label: 'Salons' },
    { value: 'search', label: 'Recherches' },
    { value: 'page', label: 'Pages' },
    { value: 'other', label: 'Autres' }
];

const iconMap = {
    resource: LuBookOpen,
    favorite: LuHeart,
    salon: LuMessageCircle,
    search: LuSearch,
    page: LuExternalLink,
    action: LuSparkles,
    other: LuClock
};

const formatRelativeTime = (timestamp) => {
    const diffMs = Date.now() - timestamp;
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

    if (diffMinutes < 1) return "A l'instant";
    if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Il y a ${diffHours} h`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `Il y a ${diffDays} j`;

    return new Date(timestamp).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
};

const RecentHistory = () => {
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [query, setQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [confirmClear, setConfirmClear] = useState(false);

    const refreshHistory = () => setHistory(getLocalHistory());

    useEffect(() => {
        refreshHistory();
        window.addEventListener('local-history:changed', refreshHistory);
        return () => window.removeEventListener('local-history:changed', refreshHistory);
    }, []);

    const filteredHistory = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return history.filter((item) => {
            const typeMatches = activeFilter === 'all' || item.type === activeFilter || (activeFilter === 'other' && item.type === 'action');
            const queryMatches = !normalizedQuery || [item.title, item.description, getHistoryTypeLabel(item.type)]
                .join(' ')
                .toLowerCase()
                .includes(normalizedQuery);
            return typeMatches && queryMatches;
        });
    }, [activeFilter, history, query]);

    const openItem = (item) => {
        if (!item.url) return;
        if (item.url.startsWith('http')) {
            window.open(item.url, '_blank', 'noopener,noreferrer');
            return;
        }
        navigate(item.url);
    };

    const removeItem = (id) => {
        removeLocalHistoryItem(id);
        refreshHistory();
    };

    const clearAll = () => {
        clearLocalHistory();
        setConfirmClear(false);
        refreshHistory();
    };

    return (
        <section className="recent-history-card" aria-labelledby="recent-history-title">
            <div className="recent-history-header">
                <div>
                    <span className="recent-history-kicker">Local et privé</span>
                    <h2 id="recent-history-title">Historique récent</h2>
                    <p>Vos dernières activités restent uniquement dans ce navigateur.</p>
                </div>
                {history.length > 0 && (
                    <button className="recent-history-clear" onClick={() => setConfirmClear(true)}>
                        <LuTrash2 />
                        Vider l'historique
                    </button>
                )}
            </div>

            <div className="recent-history-controls">
                <div className="recent-history-search">
                    <LuSearch />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Rechercher une activité..."
                        aria-label="Rechercher dans l'historique"
                    />
                    {query && (
                        <button type="button" onClick={() => setQuery('')} aria-label="Effacer la recherche">
                            <LuX />
                        </button>
                    )}
                </div>
                <div className="recent-history-filters" aria-label="Filtrer l'historique">
                    {filters.map((filter) => (
                        <button
                            key={filter.value}
                            className={activeFilter === filter.value ? 'active' : ''}
                            onClick={() => setActiveFilter(filter.value)}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>

            {filteredHistory.length === 0 ? (
                <div className="recent-history-empty">
                    <LuClock />
                    <h3>Aucun historique</h3>
                    <p>{history.length === 0 ? 'Vos prochaines activités apparaîtront ici.' : 'Aucun élément ne correspond à ce filtre.'}</p>
                </div>
            ) : (
                <div className="recent-history-list">
                    {filteredHistory.map((item, index) => {
                        const Icon = iconMap[item.type] || iconMap.other;
                        return (
                            <article className="recent-history-item" key={item.id} style={{ animationDelay: `${Math.min(index * 35, 280)}ms` }}>
                                <button className="recent-history-main" onClick={() => openItem(item)} disabled={!item.url}>
                                    <span className={`recent-history-icon ${item.type}`}>
                                        <Icon />
                                    </span>
                                    <span className="recent-history-copy">
                                        <strong>{item.title}</strong>
                                        <small>{item.description || 'Activité enregistrée localement'}</small>
                                    </span>
                                </button>
                                <span className="recent-history-type">{getHistoryTypeLabel(item.type)}</span>
                                <time>{formatRelativeTime(item.timestamp)}</time>
                                <button className="recent-history-delete" onClick={() => removeItem(item.id)} aria-label="Supprimer cet élément">
                                    <LuTrash2 />
                                </button>
                            </article>
                        );
                    })}
                </div>
            )}

            {confirmClear && (
                <div className="recent-history-confirm" role="dialog" aria-modal="true" aria-labelledby="history-clear-title">
                    <div>
                        <h3 id="history-clear-title">Vider tout l'historique ?</h3>
                        <p>Cette action supprime uniquement les données locales de ce navigateur.</p>
                        <div>
                            <button onClick={() => setConfirmClear(false)}>Annuler</button>
                            <button className="danger" onClick={clearAll}>Tout supprimer</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default RecentHistory;
