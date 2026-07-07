import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LuArrowLeft,
    LuChartBar,
    LuCalendarDays,
    LuDownload,
    LuFilePenLine,
    LuFilter,
    LuPlus,
    LuRefreshCw,
    LuSearch,
    LuExternalLink,
    LuUserRound,
    LuUsersRound,
    LuX
} from 'react-icons/lu';
import AppNavigation from './components/AppNavigation';
import { ressourcesStatsAPI } from './api';
import { addLocalHistoryItem } from './utils/localHistory';

const actionConfig = {
    insertion: {
        label: 'Ajout',
        pluralLabel: 'Ajouts',
        icon: LuPlus,
        className: 'add'
    },
    modification: {
        label: 'Modification',
        pluralLabel: 'Modifications',
        icon: LuFilePenLine,
        className: 'edit'
    }
};

const formatInputDate = (date) => date.toISOString().slice(0, 10);

const getDefaultDates = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);

    return {
        dateDebut: formatInputDate(start),
        dateFin: formatInputDate(end)
    };
};

const formatNumber = (value) => new Intl.NumberFormat('fr-FR').format(Number(value) || 0);

const formatDate = (value) => {
    if (!value) return 'Non renseignée';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

const formatTime = (value) => {
    if (!value) return 'Non renseignée';

    const date = new Date(value);
    if (!Number.isNaN(date.getTime()) && value.includes('T')) {
        return date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    return String(value).slice(0, 5);
};

const getUserLabel = (item) => {
    const user = item.utilisateur || item.user || item.created_by || item.updated_by;

    if (typeof user === 'string') return user;

    if (user && typeof user === 'object') {
        const fullName = [user.prenom, user.nom].filter(Boolean).join(' ').trim();
        return fullName || user.username || user.email || user.nom_complet || 'Utilisateur non renseigné';
    }

    return item.utilisateur_nom ||
        item.nom_utilisateur ||
        item.username ||
        item.email ||
        item.auteur ||
        'Utilisateur non renseigné';
};

const getUserId = (item) => {
    const user = item.utilisateur || item.user || item.created_by || item.updated_by;
    if (user && typeof user === 'object') return user.id || user.pk || user.uuid || '';
    return item.utilisateur_id || item.user_id || item.auteur_id || '';
};

const getActionDate = (item) => (
    item.date ||
    item.jour ||
    item.date_action ||
    item.created_at ||
    item.updated_at ||
    item.timestamp ||
    ''
);

const getActionTime = (item, dateValue) => (
    item.heure ||
    item.time ||
    item.heure_action ||
    (dateValue && String(dateValue).includes('T') ? dateValue : '')
);

const getCount = (item) => Number(
    item.total ??
    item.nombre ??
    item.count ??
    item.actions_count ??
    item.nb_actions ??
    item.valeur ??
    1
) || 0;

const getResourceInfo = (item) => {
    const resource = item.ressource || item.resource || item.document;

    if (resource && typeof resource === 'object') {
        return {
            id: resource.id || resource.pk || resource.uuid || item.ressource_id || item.resource_id || '',
            title: resource.titre || resource.title || resource.nom || resource.libelle || 'Ressource'
        };
    }

    return {
        id: item.ressource_id || item.resource_id || '',
        title: item.ressource_titre || item.titre || resource || item.document || 'Ressource'
    };
};

const getResourceTitle = (resource) => (
    resource.titre ||
    resource.title ||
    resource.nom ||
    resource.libelle ||
    resource.name ||
    'Ressource'
);

const getResourceId = (resource, fallback = '') => (
    resource.id ||
    resource.pk ||
    resource.uuid ||
    resource.ressource_id ||
    resource.resource_id ||
    fallback ||
    ''
);

const collectResourceInfos = (item) => {
    const possibleLists = [
        item.ressources,
        item.resources,
        item.documents,
        item.liste_ressources,
        item.ressources_concernees
    ].find((value) => Array.isArray(value) && value.length > 0);

    const sourceResources = possibleLists || [item.ressource || item.resource || item.document || item]
        .filter(Boolean);

    const resources = sourceResources.map((resource) => {
        if (resource && typeof resource === 'object') {
            return {
                id: getResourceId(resource, item.ressource_id || item.resource_id),
                title: getResourceTitle(resource),
                type: resource.type || resource.type_ressource || resource.format || item.type || '',
                domain: resource.domaine?.nom || resource.domaine || resource.domaine_nom || item.domaine?.nom || item.domaine || '',
                date: resource.date || resource.created_at || resource.updated_at || item.date || item.date_action || '',
                raw: resource
            };
        }

        return {
            id: item.ressource_id || item.resource_id || '',
            title: String(resource),
            type: item.type || '',
            domain: item.domaine?.nom || item.domaine || '',
            date: item.date || item.date_action || '',
            raw: resource
        };
    });

    const uniqueResources = new Map();
    resources.forEach((resource) => {
        const key = resource.id || resource.title;
        if (!uniqueResources.has(key)) {
            uniqueResources.set(key, resource);
        }
    });

    return Array.from(uniqueResources.values());
};

const normalizeActionRows = (payload) => {
    const actions = payload?.actions || {};

    return ['insertion', 'modification'].flatMap((actionType) => {
        const stats = actions[actionType]?.statistiques;
        if (!Array.isArray(stats)) return [];

        return stats.flatMap((item, index) => {
            const details = item.actions || item.details || item.activites || item.items;

            if (Array.isArray(details) && details.length > 0) {
                return details.map((detail, detailIndex) => {
                    const merged = { ...item, ...detail };
                    const dateValue = getActionDate(merged);
                    const resourceInfo = getResourceInfo(merged);
                    const resources = collectResourceInfos(merged);

                    return {
                        id: `${actionType}-${index}-${detailIndex}`,
                        actionType,
                        userId: getUserId(merged),
                        userLabel: getUserLabel(merged),
                        count: getCount(detail) || 1,
                        date: dateValue,
                        time: getActionTime(merged, dateValue),
                        resourceId: resourceInfo.id,
                        resource: resourceInfo.title,
                        resources,
                        raw: merged
                    };
                });
            }

            const dateValue = getActionDate(item);
            const resourceInfo = getResourceInfo(item);
            const resources = collectResourceInfos(item);

            return {
                id: `${actionType}-${index}`,
                actionType,
                userId: getUserId(item),
                userLabel: getUserLabel(item),
                count: getCount(item),
                date: dateValue,
                time: getActionTime(item, dateValue),
                resourceId: resourceInfo.id,
                resource: resourceInfo.title,
                resources,
                raw: item
            };
        });
    });
};

const getMaxValue = (items) => Math.max(...items.map((item) => item.value), 1);

function StatistiquesActionsPage() {
    const navigate = useNavigate();
    const defaultDates = useMemo(getDefaultDates, []);
    const [filters, setFilters] = useState({
        date_debut: defaultDates.dateDebut,
        date_fin: defaultDates.dateFin,
        utilisateur_id: '',
        type_action: 'tous',
        group_by: 'utilisateur_date',
        search: ''
    });
    const [statsData, setStatsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedStatsRow, setSelectedStatsRow] = useState(null);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const params = {
                group_by: filters.group_by,
                date_debut: filters.date_debut,
                date_fin: filters.date_fin
            };

            if (filters.utilisateur_id) {
                params.utilisateur_id = filters.utilisateur_id;
            }

            const response = await ressourcesStatsAPI.getActionsStats(params);
            setStatsData(response);
        } catch (err) {
            setError(err.message || 'Erreur lors du chargement des statistiques');
            setStatsData(null);
        } finally {
            setLoading(false);
        }
    }, [filters.date_debut, filters.date_fin, filters.group_by, filters.utilisateur_id]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const rows = useMemo(() => normalizeActionRows(statsData), [statsData]);

    const userOptions = useMemo(() => {
        const users = new Map();
        rows.forEach((row) => {
            const key = row.userId || row.userLabel;
            if (!users.has(key)) {
                users.set(key, {
                    id: key,
                    label: row.userLabel
                });
            }
        });
        return Array.from(users.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [rows]);

    const filteredRows = useMemo(() => {
        const query = filters.search.trim().toLowerCase();

        return rows.filter((row) => {
            const userKey = row.userId || row.userLabel;
            const matchesUser = !filters.utilisateur_id || String(userKey) === String(filters.utilisateur_id);
            const matchesType = filters.type_action === 'tous' || row.actionType === filters.type_action;
            const matchesSearch = !query ||
                row.userLabel.toLowerCase().includes(query) ||
                row.resource.toLowerCase().includes(query) ||
                actionConfig[row.actionType].label.toLowerCase().includes(query);

            return matchesUser && matchesType && matchesSearch;
        });
    }, [filters.search, filters.type_action, filters.utilisateur_id, rows]);

    const totals = useMemo(() => {
        const insertions = filteredRows
            .filter((row) => row.actionType === 'insertion')
            .reduce((sum, row) => sum + row.count, 0);
        const modifications = filteredRows
            .filter((row) => row.actionType === 'modification')
            .reduce((sum, row) => sum + row.count, 0);

        if (filteredRows.length === rows.length && statsData?.totaux) {
            return {
                insertions: Number(statsData.totaux.insertions) || insertions,
                modifications: Number(statsData.totaux.modifications) || modifications
            };
        }

        return { insertions, modifications };
    }, [filteredRows, rows.length, statsData]);

    const userChart = useMemo(() => {
        const grouped = new Map();
        filteredRows.forEach((row) => {
            const current = grouped.get(row.userLabel) || 0;
            grouped.set(row.userLabel, current + row.count);
        });

        return Array.from(grouped, ([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [filteredRows]);

    const periodChart = useMemo(() => {
        const grouped = new Map();
        filteredRows.forEach((row) => {
            const label = row.date ? formatDate(row.date) : 'Date inconnue';
            grouped.set(label, (grouped.get(label) || 0) + row.count);
        });

        return Array.from(grouped, ([label, value]) => ({ label, value }));
    }, [filteredRows]);

    const typeChart = [
        { label: 'Ajouts', value: totals.insertions, className: 'add' },
        { label: 'Modifications', value: totals.modifications, className: 'edit' }
    ];

    const totalActions = totals.insertions + totals.modifications;
    const activeUsers = userChart.length;

    const handleFilterChange = (event) => {
        const { name, value } = event.target;
        setFilters((current) => ({
            ...current,
            [name]: value
        }));
    };

    const applyFilters = (event) => {
        event.preventDefault();
        fetchStats();
        addLocalHistoryItem({
            type: 'action',
            title: 'Filtrage statistiques',
            description: 'Recherche dans le rapport des ajouts et modifications',
            url: '/profile/statistiques',
            icon: 'action'
        });
    };

    const resetFilters = () => {
        setFilters({
            date_debut: defaultDates.dateDebut,
            date_fin: defaultDates.dateFin,
            utilisateur_id: '',
            type_action: 'tous',
            group_by: 'utilisateur_date',
            search: ''
        });
    };

    const exportCsv = () => {
        const header = ['Action', 'Utilisateur', 'Nombre', 'Date', 'Heure', 'Ressource'];
        const body = filteredRows.map((row) => [
            actionConfig[row.actionType].label,
            row.userLabel,
            row.count,
            formatDate(row.date),
            formatTime(row.time),
            row.resource
        ]);

        const csv = [header, ...body]
            .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `statistiques-actions-${filters.date_debut}-${filters.date_fin}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const openResourcesDrawer = (row) => {
        setSelectedStatsRow(row);
    };

    const closeResourcesDrawer = () => {
        setSelectedStatsRow(null);
    };

    const openResourceDetails = (resourceId) => {
        if (!resourceId) return;
        closeResourcesDrawer();
        navigate(`/ressources/${resourceId}`);
    };

    const renderBarChart = (items, modifier = '') => {
        const maxValue = getMaxValue(items);

        if (items.length === 0) {
            return (
                <div className="stats-empty-mini">
                    Aucune donnée disponible pour ce graphique.
                </div>
            );
        }

        return (
            <div className={`stats-bars ${modifier}`}>
                {items.map((item) => (
                    <div className="stats-bar-row" key={item.label}>
                        <span className="stats-bar-label">{item.label}</span>
                        <div className="stats-bar-track" aria-hidden="true">
                            <span
                                className={`stats-bar-fill ${item.className || ''}`}
                                style={{ width: `${Math.max((item.value / maxValue) * 100, 3)}%` }}
                            />
                        </div>
                        <strong>{formatNumber(item.value)}</strong>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="stats-page">
            <AppNavigation />
            <main className="stats-main">
                <section className="stats-hero">
                    <button type="button" className="stats-back-btn" onClick={() => navigate('/profile')}>
                        <LuArrowLeft />
                        Profil
                    </button>
                    <div>
                        <span className="stats-eyebrow"><LuChartBar /> Rapport statistique</span>
                        <h1>Ajouts et modifications des ressources</h1>
                        <p>
                            Analyse des actions réalisées dans le système par utilisateur, période et type d'action.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="stats-export-btn"
                        onClick={exportCsv}
                        disabled={filteredRows.length === 0}
                    >
                        <LuDownload />
                        Exporter
                    </button>
                </section>

                <form className="stats-filters" onSubmit={applyFilters}>
                    <div className="stats-filter-heading">
                        <span><LuFilter /> Filtres</span>
                        <button type="button" onClick={resetFilters}>Réinitialiser</button>
                    </div>
                    <div className="stats-filter-grid">
                        <label>
                            <span>Date début</span>
                            <input type="date" name="date_debut" value={filters.date_debut} onChange={handleFilterChange} />
                        </label>
                        <label>
                            <span>Date fin</span>
                            <input type="date" name="date_fin" value={filters.date_fin} onChange={handleFilterChange} />
                        </label>
                        <label>
                            <span>Utilisateur</span>
                            <select name="utilisateur_id" value={filters.utilisateur_id} onChange={handleFilterChange}>
                                <option value="">Tous les utilisateurs</option>
                                {userOptions.map((user) => (
                                    <option key={user.id || user.label} value={user.id}>
                                        {user.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <span>Type d'action</span>
                            <select name="type_action" value={filters.type_action} onChange={handleFilterChange}>
                                <option value="tous">Ajouts et modifications</option>
                                <option value="insertion">Ajouts seulement</option>
                                <option value="modification">Modifications seulement</option>
                            </select>
                        </label>
                        {/* <label>
                            <span>Regroupement</span>
                            <select name="group_by" value={filters.group_by} onChange={handleFilterChange}>
                                <option value="utilisateur_date">Utilisateur et date</option>
                                <option value="utilisateur">Utilisateur</option>
                                <option value="date">Période</option>
                                <option value="type_action">Type d'action</option>
                            </select>
                        </label> */}
                        <label className="stats-search-field">
                            <span>Recherche</span>
                            <LuSearch />
                            <input
                                type="search"
                                name="search"
                                value={filters.search}
                                onChange={handleFilterChange}
                                placeholder="Utilisateur, ressource, action..."
                            />
                        </label>
                    </div>
                    <button type="submit" className="stats-apply-btn" disabled={loading}>
                        <LuRefreshCw className={loading ? 'spinning' : ''} />
                        {loading ? 'Chargement...' : 'Appliquer les filtres'}
                    </button>
                </form>

                {error && <div className="stats-alert">{error}</div>}

                <section className="stats-kpis" aria-label="Indicateurs principaux">
                    <article className="stats-kpi add">
                        <LuPlus />
                        <span>Total ajouts</span>
                        <strong>{formatNumber(totals.insertions)}</strong>
                    </article>
                    <article className="stats-kpi edit">
                        <LuFilePenLine />
                        <span>Total modifications</span>
                        <strong>{formatNumber(totals.modifications)}</strong>
                    </article>
                    <article className="stats-kpi users">
                        <LuUsersRound />
                        <span>Utilisateurs actifs</span>
                        <strong>{formatNumber(activeUsers)}</strong>
                    </article>
                    <article className="stats-kpi total">
                        <LuCalendarDays />
                        <span>Actions analysées</span>
                        <strong>{formatNumber(totalActions)}</strong>
                    </article>
                </section>

                <section className="stats-chart-grid">
                    <article className="stats-panel">
                        <div className="stats-panel-heading">
                            <span>Par utilisateur</span>
                            <LuUserRound />
                        </div>
                        {renderBarChart(userChart)}
                    </article>
                    <article className="stats-panel">
                        <div className="stats-panel-heading">
                            <span>Par période</span>
                            <LuCalendarDays />
                        </div>
                        {renderBarChart(periodChart)}
                    </article>
                    <article className="stats-panel">
                        <div className="stats-panel-heading">
                            <span>Par type d'action</span>
                            <LuChartBar />
                        </div>
                        {renderBarChart(typeChart, 'type')}
                    </article>
                </section>

                <section className="stats-table-panel">
                    <div className="stats-table-heading">
                        <div>
                            <span>Activités détaillées</span>
                            <h2>Journal des ajouts et modifications</h2>
                        </div>
                        <strong>{formatNumber(filteredRows.length)} ligne(s)</strong>
                    </div>

                    {loading ? (
                        <div className="stats-loading">
                            <span className="loading-spinner" />
                            Chargement des activités...
                        </div>
                    ) : filteredRows.length === 0 ? (
                        <div className="stats-empty-state">
                            <LuChartBar />
                            <h3>Aucune activité trouvée</h3>
                            <p>Essayez une autre période, un autre utilisateur ou un autre type d'action.</p>
                        </div>
                    ) : (
                        <div className="stats-table-wrap">
                            <table className="stats-table">
                                <thead>
                                    <tr>
                                        <th>Action</th>
                                        <th>Utilisateur</th>
                                        <th>Nombre</th>
                                        <th>Date</th>
                                        {/* <th>Heure</th> */}
                                        <th>Ressource</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRows.map((row) => {
                                        const config = actionConfig[row.actionType];
                                        const Icon = config.icon;

                                        return (
                                            <tr key={row.id}>
                                                <td>
                                                    <span className={`stats-action-pill ${config.className}`}>
                                                        <Icon />
                                                        {config.label}
                                                    </span>
                                                </td>
                                                <td>{row.userLabel}</td>
                                                <td>{formatNumber(row.count)}</td>
                                                <td>{formatDate(row.date)}</td>
                                                {/* <td>{formatTime(row.time)}</td> */}
                                                <td>
                                                    {(row.resources?.length || row.resourceId) ? (
                                                        <button
                                                            type="button"
                                                            className="stats-resource-link"
                                                            onClick={() => openResourcesDrawer(row)}
                                                            title="Voir les ressources concernées"
                                                        >
                                                            <span>
                                                                {row.resources?.length > 1
                                                                    ? `${formatNumber(row.resources.length)} ressources concernées`
                                                                    : row.resource}
                                                            </span>
                                                            <small>
                                                                {row.resources?.length > 1
                                                                    ? 'Afficher la liste détaillée'
                                                                    : `ID ${row.resourceId || 'non renseigné'}`}
                                                            </small>
                                                        </button>
                                                    ) : (
                                                        row.resource
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </main>

            {selectedStatsRow && (
                <div className="stats-drawer-overlay" role="presentation" onClick={closeResourcesDrawer}>
                    <aside
                        className="stats-resources-drawer"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="stats-resources-drawer-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="stats-drawer-header">
                            <div>
                                <span>Ressources concernées</span>
                                <h2 id="stats-resources-drawer-title">
                                    {actionConfig[selectedStatsRow.actionType].label} du {formatDate(selectedStatsRow.date)}
                                </h2>
                            </div>
                            <button type="button" onClick={closeResourcesDrawer} aria-label="Fermer">
                                <LuX />
                            </button>
                        </div>

                        <div className="stats-drawer-summary">
                            <span>{selectedStatsRow.userLabel}</span>
                            <strong>{formatNumber(selectedStatsRow.count)} action(s)</strong>
                        </div>

                        <div className="stats-drawer-list">
                            {(selectedStatsRow.resources?.length
                                ? selectedStatsRow.resources
                                : [{
                                    id: selectedStatsRow.resourceId,
                                    title: selectedStatsRow.resource,
                                    type: '',
                                    domain: '',
                                    date: selectedStatsRow.date
                                }]
                            ).map((resource, index) => (
                                <article className="stats-drawer-resource" key={resource.id || `${resource.title}-${index}`}>
                                    <div>
                                        <h3>{resource.title}</h3>
                                        <div className="stats-drawer-resource-meta">
                                            {resource.id && <span>ID {resource.id}</span>}
                                            {resource.type && <span>{resource.type}</span>}
                                            {resource.domain && <span>{resource.domain}</span>}
                                            {resource.date && <span>{formatDate(resource.date)}</span>}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => openResourceDetails(resource.id)}
                                        disabled={!resource.id}
                                    >
                                        <LuExternalLink />
                                        Détail
                                    </button>
                                </article>
                            ))}
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}

export default StatistiquesActionsPage;
