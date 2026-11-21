import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LuActivity,
    LuArrowLeft,
    LuCalendarDays,
    LuChartBar,
    LuChevronLeft,
    LuChevronRight,
    LuDatabase,
    LuDownload,
    LuExternalLink,
    LuEye,
    LuFileText,
    LuFilter,
    LuListOrdered,
    LuRefreshCw,
    LuSearch,
    LuShieldCheck,
    LuTriangleAlert,
    LuUsersRound
} from 'react-icons/lu';
import AppNavigation from './components/AppNavigation';
import {
    consultationsAPI,
    CONSULTATION_ACTIONS,
    CONSULTATION_PERIODES,
    CONSULTATION_SOURCES
} from './services/consultationsApi';
import { addLocalHistoryItem } from './utils/localHistory';
import './styles/Consultations.css';

const SUMMARY_PERIODS = ['aujourdhui', 'hier', 'semaine_passee', 'mois_passe'];
const ACTION_KEYS = ['recherche', 'detail', 'pdf'];
const ACTION_SHORT_LABELS = { recherche: 'Recherches', detail: 'Fiches', pdf: 'Fichiers / PDF' };
const PAGE_SIZES = [20, 50, 100, 200];
const MAX_CHART_COLUMNS = 62;

const formatNumber = (value) => new Intl.NumberFormat('fr-FR').format(Number(value) || 0);

const formatInputDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseDateOnly = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
};

const formatDate = (value, options = { day: '2-digit', month: 'short', year: 'numeric' }) => {
    if (!value) return '—';
    const date = parseDateOnly(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('fr-FR', options);
};

const formatDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const formatRange = (debut, fin) => {
    if (!debut && !fin) return 'Toutes les dates';
    if (debut === fin) return formatDate(debut);
    return `${formatDate(debut)} → ${formatDate(fin)}`;
};

const percent = (value, total) => (total > 0 ? Math.round((value / total) * 1000) / 10 : 0);

const isCanceledRequest = (error) => error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

const getSourceLabel = (code, sources = CONSULTATION_SOURCES) => (
    sources.find((source) => source.code === code)?.libelle || code
);

// Lien vers la fiche de la ressource dans l'application.
const getResourceUrl = (source, id) => {
    if (!id) return null;
    const encoded = encodeURIComponent(id);
    if (source === 'hal') return `/ressources/externes/hal/${encoded}`;
    if (source === 'openalex') return `/ressources/externes/openalex/${encoded}`;
    return `/ressources/${encoded}`;
};

// Regroupe les jours en semaines ou en mois quand l'intervalle est trop long pour un graphique lisible.
const groupDailyRows = (rows, sourceCodes) => {
    if (rows.length <= MAX_CHART_COLUMNS) {
        return {
            granularity: 'jour',
            items: rows.map((row) => ({
                key: row.date,
                label: formatDate(row.date, { day: '2-digit', month: 'short' }),
                title: formatDate(row.date, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
                values: Object.fromEntries(sourceCodes.map((code) => [code, Number(row[code]) || 0])),
                total: Number(row.total) || 0
            }))
        };
    }

    const byMonth = rows.length > 366;
    const grouped = new Map();

    rows.forEach((row) => {
        const date = parseDateOnly(row.date);
        let key;
        let label;
        let title;
        if (byMonth) {
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            label = date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
            title = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        } else {
            const monday = new Date(date);
            monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
            key = formatInputDate(monday);
            label = formatDate(key, { day: '2-digit', month: 'short' });
            title = `Semaine du ${formatDate(key, { day: '2-digit', month: 'long', year: 'numeric' })}`;
        }

        const current = grouped.get(key) || {
            key,
            label,
            title,
            values: Object.fromEntries(sourceCodes.map((code) => [code, 0])),
            total: 0
        };
        sourceCodes.forEach((code) => { current.values[code] += Number(row[code]) || 0; });
        current.total += Number(row.total) || 0;
        grouped.set(key, current);
    });

    return { granularity: byMonth ? 'mois' : 'semaine', items: Array.from(grouped.values()) };
};

function StatistiquesConsultationsPage() {
    const navigate = useNavigate();
    const today = useMemo(() => formatInputDate(new Date()), []);

    // Filtres de l'analyse
    const [periode, setPeriode] = useState('cette_semaine');
    const [selectedSources, setSelectedSources] = useState(CONSULTATION_SOURCES.map((source) => source.code));
    const [dateDebut, setDateDebut] = useState(() => {
        const start = new Date();
        start.setDate(start.getDate() - 29);
        return formatInputDate(start);
    });
    const [dateFin, setDateFin] = useState(today);
    const [appliedRange, setAppliedRange] = useState({ date_debut: dateDebut, date_fin: dateFin });
    const [refreshKey, setRefreshKey] = useState(0);

    // Données
    const [summary, setSummary] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(true);
    const [summaryError, setSummaryError] = useState('');
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [statsError, setStatsError] = useState('');

    // Journal détaillé
    const [journalFilters, setJournalFilters] = useState({ action: '', ressource_id: '' });
    const [appliedJournalFilters, setAppliedJournalFilters] = useState({ action: '', ressource_id: '' });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [journal, setJournal] = useState(null);
    const [journalLoading, setJournalLoading] = useState(true);
    const [journalError, setJournalError] = useState('');

    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState('');

    const sourceParam = selectedSources.length === CONSULTATION_SOURCES.length ? '' : selectedSources.join(',');
    const invalidRange = periode === 'intervalle' && (!dateDebut || !dateFin || dateDebut > dateFin);

    const periodParams = useMemo(() => {
        const params = { periode, source: sourceParam };
        if (periode === 'intervalle') {
            params.date_debut = appliedRange.date_debut;
            params.date_fin = appliedRange.date_fin;
        }
        return params;
    }, [appliedRange, periode, sourceParam]);

    // Résumé des 4 périodes + diagnostic
    useEffect(() => {
        if (selectedSources.length === 0) return undefined;
        const controller = new AbortController();
        setSummaryLoading(true);
        setSummaryError('');

        consultationsAPI.getStatistiques({ source: sourceParam }, { signal: controller.signal })
            .then((data) => setSummary(data))
            .catch((error) => {
                if (controller.signal.aborted || isCanceledRequest(error)) return;
                setSummaryError(error.message);
                setSummary(null);
            })
            .finally(() => {
                if (!controller.signal.aborted) setSummaryLoading(false);
            });

        return () => controller.abort();
    }, [sourceParam, selectedSources.length, refreshKey]);

    // Statistiques détaillées de la période choisie
    useEffect(() => {
        if (selectedSources.length === 0) return undefined;
        const controller = new AbortController();
        setStatsLoading(true);
        setStatsError('');

        consultationsAPI.getStatistiques(periodParams, { signal: controller.signal })
            .then((data) => setStats(data))
            .catch((error) => {
                if (controller.signal.aborted || isCanceledRequest(error)) return;
                setStatsError(error.message);
                setStats(null);
            })
            .finally(() => {
                if (!controller.signal.aborted) setStatsLoading(false);
            });

        return () => controller.abort();
    }, [periodParams, selectedSources.length, refreshKey]);

    // Journal ligne par ligne
    useEffect(() => {
        if (selectedSources.length === 0) return undefined;
        const controller = new AbortController();
        setJournalLoading(true);
        setJournalError('');

        consultationsAPI.getConsultations({
            ...periodParams,
            action: appliedJournalFilters.action,
            ressource_id: appliedJournalFilters.ressource_id.trim(),
            page,
            page_size: pageSize
        }, { signal: controller.signal })
            .then((data) => setJournal(data))
            .catch((error) => {
                if (controller.signal.aborted || isCanceledRequest(error)) return;
                setJournalError(error.message);
                setJournal(null);
            })
            .finally(() => {
                if (!controller.signal.aborted) setJournalLoading(false);
            });

        return () => controller.abort();
    }, [appliedJournalFilters, page, pageSize, periodParams, selectedSources.length, refreshKey]);

    // Revenir à la page 1 dès que la période ou les sources changent
    useEffect(() => { setPage(1); }, [periodParams]);

    const sources = useMemo(() => (
        stats?.sources?.length ? stats.sources : CONSULTATION_SOURCES.filter((s) => selectedSources.includes(s.code))
    ), [selectedSources, stats]);
    const sourceCodes = useMemo(() => sources.map((source) => source.code), [sources]);

    const total = Number(stats?.total) || 0;
    const parSource = useMemo(() => stats?.par_source || {}, [stats]);

    const actionTotals = useMemo(() => ACTION_KEYS.reduce((acc, key) => {
        acc[key] = sourceCodes.reduce((sum, code) => sum + (Number(parSource[code]?.[key]) || 0), 0);
        return acc;
    }, {}), [parSource, sourceCodes]);

    const dailyChart = useMemo(
        () => groupDailyRows(stats?.par_jour || [], sourceCodes),
        [sourceCodes, stats]
    );
    const chartMax = Math.max(...dailyChart.items.map((item) => item.total), 1);
    const daysCount = stats?.par_jour?.length || 0;
    const busiestDay = useMemo(() => (stats?.par_jour || []).reduce(
        (best, row) => (!best || (Number(row.total) || 0) > (Number(best.total) || 0) ? row : best),
        null
    ), [stats]);
    const dailyAverage = daysCount ? total / daysCount : 0;

    const periodeLabel = stats?.periode?.libelle
        || CONSULTATION_PERIODES.find((item) => item.code === periode)?.libelle
        || '';

    const toggleSource = (code) => {
        setSelectedSources((current) => {
            if (current.includes(code)) {
                return current.length === 1 ? current : current.filter((item) => item !== code);
            }
            return CONSULTATION_SOURCES.map((s) => s.code).filter((item) => item === code || current.includes(item));
        });
    };

    const selectPeriode = (code) => {
        setPeriode(code);
        if (code !== 'intervalle') {
            addLocalHistoryItem({
                type: 'action',
                title: 'Statistiques de consultation',
                description: `Période : ${CONSULTATION_PERIODES.find((item) => item.code === code)?.libelle}`,
                url: '/profile/consultations',
                icon: 'action'
            });
        }
    };

    const applyInterval = (event) => {
        event.preventDefault();
        if (invalidRange) return;
        setAppliedRange({ date_debut: dateDebut, date_fin: dateFin });
    };

    const applyJournalFilters = (event) => {
        event.preventDefault();
        setPage(1);
        setAppliedJournalFilters({ ...journalFilters });
    };

    const resetJournalFilters = () => {
        const empty = { action: '', ressource_id: '' };
        setJournalFilters(empty);
        setAppliedJournalFilters(empty);
        setPage(1);
    };

    const showResourceJournal = (resourceId) => {
        const next = { action: '', ressource_id: String(resourceId) };
        setJournalFilters(next);
        setAppliedJournalFilters(next);
        setPage(1);
        document.getElementById('consult-journal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const refreshAll = () => setRefreshKey((key) => key + 1);

    const journalCount = Number(journal?.count) || 0;
    const totalPages = Math.max(1, Math.ceil(journalCount / pageSize));

    const exportExcel = useCallback(async () => {
        if (!stats) return;
        setExporting(true);
        setExportError('');
        try {
            const { default: ExcelJS } = await import('exceljs');
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Bibliothèque Numérique Nationale';
            workbook.created = new Date();

            const headerStyle = (row) => {
                row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E42AC' } };
                row.alignment = { vertical: 'middle' };
            };
            const range = formatRange(stats.periode?.date_debut, stats.periode?.date_fin);

            const resume = workbook.addWorksheet('Résumé');
            resume.columns = [{ width: 28 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 12 }];
            resume.addRow(['Statistiques des consultations']).font = { bold: true, size: 14 };
            resume.addRow([`Période : ${periodeLabel} (${range})`]);
            resume.addRow([`Total : ${total}`, '', `Visiteurs uniques : ${stats.visiteurs_uniques ?? 0}`]);
            resume.addRow([]);
            headerStyle(resume.addRow(['Source', 'Recherches', 'Fiches', 'Fichiers / PDF', 'Total', 'Part (%)']));
            sources.forEach((source) => {
                const item = parSource[source.code] || {};
                resume.addRow([
                    source.libelle,
                    item.recherche || 0,
                    item.detail || 0,
                    item.pdf || 0,
                    item.total || 0,
                    percent(item.total || 0, total)
                ]);
            });
            resume.addRow(['Total', actionTotals.recherche, actionTotals.detail, actionTotals.pdf, total, 100]).font = { bold: true };

            const jours = workbook.addWorksheet('Par jour');
            jours.columns = [{ width: 14 }, ...sources.map(() => ({ width: 16 })), { width: 12 }];
            headerStyle(jours.addRow(['Date', ...sources.map((source) => source.libelle), 'Total']));
            (stats.par_jour || []).forEach((row) => {
                jours.addRow([row.date, ...sourceCodes.map((code) => row[code] || 0), row.total || 0]);
            });

            const top = workbook.addWorksheet('Top ressources');
            top.columns = [{ width: 18 }, { width: 8 }, { width: 30 }, { width: 16 }];
            headerStyle(top.addRow(['Source', 'Rang', 'Identifiant', 'Consultations']));
            sources.forEach((source) => {
                (stats.top_ressources?.[source.code] || []).forEach((item, index) => {
                    top.addRow([source.libelle, index + 1, item.ressource_id, item.consultations]);
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `consultations_${stats.periode?.code || periode}_${stats.periode?.date_debut || today}.xlsx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (error) {
            setExportError(error.message || "L'export Excel a échoué.");
        } finally {
            setExporting(false);
        }
    }, [actionTotals, parSource, periode, periodeLabel, sourceCodes, sources, stats, today, total]);

    const diagnostic = summary?.diagnostic;
    const diagnosticOk = diagnostic && diagnostic.middleware_actif && diagnostic.ecriture_possible;

    return (
        <div className="stats-page consult-page">
            <AppNavigation />
            <main className="stats-main">
                <section className="stats-hero">
                    <button type="button" className="stats-back-btn" onClick={() => navigate('/profile')}>
                        <LuArrowLeft />
                        Profil
                    </button>
                    <div>
                        <span className="stats-eyebrow"><LuEye /> Statistiques de consultation</span>
                        <h1>Consultations des ressources</h1>
                        <p>
                            Suivi des recherches, fiches consultées et fichiers ouverts sur les sources
                            BNN interne, HAL et OpenAlex.
                        </p>
                    </div>
                    <div className="stats-export-actions">
                        <button
                            type="button"
                            className="stats-back-btn"
                            onClick={refreshAll}
                            disabled={statsLoading || summaryLoading}
                        >
                            <LuRefreshCw className={statsLoading || summaryLoading ? 'spinning' : ''} />
                            Actualiser
                        </button>
                        <button
                            type="button"
                            className="stats-export-btn"
                            onClick={exportExcel}
                            disabled={!stats || exporting}
                        >
                            <LuDownload className={exporting ? 'spinning' : ''} />
                            {exporting ? 'Création du fichier...' : 'Exporter Excel'}
                        </button>
                    </div>
                </section>

                {exportError && <div className="stats-alert" role="alert">{exportError}</div>}

                {/* Résumé des périodes */}
                <section className="consult-summary" aria-label="Résumé des périodes">
                    {SUMMARY_PERIODS.map((code) => {
                        const item = summary?.periodes?.[code];
                        const itemTotal = Number(item?.total) || 0;
                        return (
                            <button
                                type="button"
                                key={code}
                                className={`consult-summary-card ${periode === code ? 'active' : ''}`}
                                onClick={() => selectPeriode(code)}
                            >
                                <div className="consult-summary-head">
                                    <span>{item?.libelle || CONSULTATION_PERIODES.find((p) => p.code === code)?.libelle}</span>
                                    <small>{item ? formatRange(item.date_debut, item.date_fin) : '—'}</small>
                                </div>
                                <strong>{summaryLoading ? '…' : formatNumber(itemTotal)}</strong>
                                <div className="consult-stack" aria-hidden="true">
                                    {sourceCodes.map((sourceCode) => {
                                        const value = Number(item?.par_source?.[sourceCode]) || 0;
                                        return value > 0 ? (
                                            <span
                                                key={sourceCode}
                                                className={`consult-src-${sourceCode}`}
                                                style={{ width: `${percent(value, itemTotal)}%` }}
                                            />
                                        ) : null;
                                    })}
                                </div>
                                <ul className="consult-summary-sources">
                                    {sourceCodes.map((sourceCode) => (
                                        <li key={sourceCode}>
                                            <i className={`consult-dot consult-src-${sourceCode}`} />
                                            {getSourceLabel(sourceCode, sources)}
                                            <b>{formatNumber(item?.par_source?.[sourceCode])}</b>
                                        </li>
                                    ))}
                                </ul>
                            </button>
                        );
                    })}
                </section>

                {summaryError && <div className="stats-alert" role="alert">{summaryError}</div>}

                {/* Diagnostic serveur */}
                {diagnostic && (
                    <section className={`consult-diagnostic ${diagnosticOk ? 'ok' : 'warn'}`}>
                        {diagnosticOk ? <LuShieldCheck /> : <LuTriangleAlert />}
                        <div>
                            <strong>
                                {diagnosticOk
                                    ? 'Enregistrement des consultations opérationnel'
                                    : "Problème d'enregistrement des consultations"}
                            </strong>
                            <ul>
                                <li>Suivi : <b>{diagnostic.middleware_actif ? 'actif' : 'inactif'}</b></li>
                                <li>Écriture : <b>{diagnostic.ecriture_possible ? 'possible' : 'impossible'}</b></li>
                                {diagnostic.erreur_ecriture && <li>Erreur : <b>{diagnostic.erreur_ecriture}</b></li>}
                                <li>Dernier enregistrement : <b>{formatDateTime(diagnostic.dernier_enregistrement)}</b></li>
                            </ul>
                        </div>
                    </section>
                )}

                {/* Filtres */}
                <form className="stats-filters" onSubmit={applyInterval}>
                    <div className="stats-filter-heading">
                        <span><LuFilter /> Période et sources</span>
                        {stats?.periode && (
                            <small className="consult-range-label">
                                <LuCalendarDays /> {formatRange(stats.periode.date_debut, stats.periode.date_fin)}
                            </small>
                        )}
                    </div>
                    <div className="consult-chips" role="radiogroup" aria-label="Période">
                        {CONSULTATION_PERIODES.map((item) => (
                            <button
                                type="button"
                                key={item.code}
                                role="radio"
                                aria-checked={periode === item.code}
                                className={`consult-chip ${periode === item.code ? 'active' : ''}`}
                                onClick={() => selectPeriode(item.code)}
                            >
                                {item.libelle}
                            </button>
                        ))}
                    </div>

                    {periode === 'intervalle' && (
                        <div className="stats-filter-grid consult-interval">
                            <label>
                                <span>Date début</span>
                                <input
                                    type="date"
                                    value={dateDebut}
                                    max={dateFin || today}
                                    onChange={(event) => setDateDebut(event.target.value)}
                                />
                            </label>
                            <label>
                                <span>Date fin</span>
                                <input
                                    type="date"
                                    value={dateFin}
                                    min={dateDebut || undefined}
                                    max={today}
                                    onChange={(event) => setDateFin(event.target.value)}
                                />
                            </label>
                            <button type="submit" className="stats-apply-btn" disabled={invalidRange || statsLoading}>
                                <LuRefreshCw className={statsLoading ? 'spinning' : ''} />
                                Appliquer
                            </button>
                        </div>
                    )}
                    {invalidRange && (
                        <div className="stats-alert consult-inline-alert" role="alert">
                            La date de début doit être antérieure ou égale à la date de fin.
                        </div>
                    )}

                    <div className="consult-source-toggle" role="group" aria-label="Sources">
                        {CONSULTATION_SOURCES.map((source) => {
                            const active = selectedSources.includes(source.code);
                            return (
                                <button
                                    type="button"
                                    key={source.code}
                                    aria-pressed={active}
                                    className={`consult-source-btn ${active ? 'active' : ''}`}
                                    onClick={() => toggleSource(source.code)}
                                    title={active && selectedSources.length === 1 ? 'Au moins une source est requise' : ''}
                                >
                                    <i className={`consult-dot consult-src-${source.code}`} />
                                    {source.libelle}
                                </button>
                            );
                        })}
                    </div>
                </form>

                {statsError && <div className="stats-alert" role="alert">{statsError}</div>}

                {/* Indicateurs */}
                <section className="stats-kpis consult-kpis" aria-label="Indicateurs principaux">
                    <article className="stats-kpi total">
                        <LuActivity />
                        <span>Consultations ({periodeLabel})</span>
                        <strong>{statsLoading ? '…' : formatNumber(total)}</strong>
                    </article>
                    <article className="stats-kpi users">
                        <LuUsersRound />
                        <span>Visiteurs uniques</span>
                        <strong>{statsLoading ? '…' : formatNumber(stats?.visiteurs_uniques)}</strong>
                    </article>
                    <article className="stats-kpi add">
                        <LuCalendarDays />
                        <span>Moyenne par jour</span>
                        <strong>{statsLoading ? '…' : formatNumber(Math.round(dailyAverage * 10) / 10)}</strong>
                    </article>
                    <article className="stats-kpi edit">
                        <LuChartBar />
                        <span>Jour le plus actif</span>
                        <strong>{statsLoading ? '…' : formatNumber(busiestDay?.total)}</strong>
                        <small className="consult-kpi-sub">
                            {busiestDay && Number(busiestDay.total) > 0 ? formatDate(busiestDay.date) : 'Aucune activité'}
                        </small>
                    </article>
                </section>

                <section className="consult-actions-kpis" aria-label="Répartition par type de consultation">
                    {ACTION_KEYS.map((key) => (
                        <article key={key} className={`consult-action-kpi consult-act-${key}`}>
                            {key === 'recherche' ? <LuSearch /> : key === 'detail' ? <LuEye /> : <LuFileText />}
                            <div>
                                <span>{CONSULTATION_ACTIONS.find((a) => a.code === key)?.libelle}</span>
                                <strong>{statsLoading ? '…' : formatNumber(actionTotals[key])}</strong>
                            </div>
                            <em>{percent(actionTotals[key], total)} %</em>
                        </article>
                    ))}
                </section>

                {/* Évolution */}
                <section className="stats-panel consult-chart-panel">
                    <div className="stats-panel-heading">
                        <span><LuChartBar /> Évolution des consultations par {dailyChart.granularity}</span>
                        <div className="consult-legend">
                            {sources.map((source) => (
                                <span key={source.code}>
                                    <i className={`consult-dot consult-src-${source.code}`} />
                                    {source.libelle}
                                </span>
                            ))}
                        </div>
                    </div>
                    {statsLoading ? (
                        <div className="stats-loading"><span className="loading-spinner" />Chargement du graphique...</div>
                    ) : dailyChart.items.length === 0 ? (
                        <div className="stats-empty-mini">Aucune donnée disponible pour cette période.</div>
                    ) : (
                        <div className="consult-columns-wrap">
                            <div className="consult-columns-axis" aria-hidden="true">
                                <span>{formatNumber(chartMax)}</span>
                                <span>{formatNumber(Math.round(chartMax / 2))}</span>
                                <span>0</span>
                            </div>
                            <div
                                className="consult-columns"
                                style={{ '--consult-cols': dailyChart.items.length }}
                                role="img"
                                aria-label={`Évolution des consultations : ${dailyChart.items.length} ${dailyChart.granularity}(s)`}
                            >
                                {dailyChart.items.map((item) => (
                                    <div className="consult-column" key={item.key}>
                                        <div className="consult-column-bar">
                                            <div
                                                className="consult-column-stack"
                                                style={{ height: `${(item.total / chartMax) * 100}%` }}
                                            >
                                                {sourceCodes.map((code) => (item.values[code] > 0 ? (
                                                    <span
                                                        key={code}
                                                        className={`consult-src-${code}`}
                                                        style={{ flexGrow: item.values[code] }}
                                                    />
                                                ) : null))}
                                            </div>
                                            <div className="consult-tooltip" role="tooltip">
                                                <b>{item.title}</b>
                                                {sourceCodes.map((code) => (
                                                    <span key={code}>
                                                        <i className={`consult-dot consult-src-${code}`} />
                                                        {getSourceLabel(code, sources)} : {formatNumber(item.values[code])}
                                                    </span>
                                                ))}
                                                <span className="consult-tooltip-total">Total : {formatNumber(item.total)}</span>
                                            </div>
                                        </div>
                                        <small>{item.label}</small>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* Détail par source */}
                <section className="stats-table-panel">
                    <div className="stats-table-heading">
                        <div>
                            <span><LuDatabase /> Répartition</span>
                            <h2>Détail par source et type de consultation</h2>
                        </div>
                        <strong>{formatNumber(total)} consultation(s)</strong>
                    </div>
                    <div className="stats-table-wrap">
                        <table className="stats-table consult-source-table">
                            <thead>
                                <tr>
                                    <th>Source</th>
                                    <th>Recherches</th>
                                    <th>Fiches</th>
                                    <th>Fichiers / PDF</th>
                                    <th>Total</th>
                                    <th>Part</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sources.map((source) => {
                                    const item = parSource[source.code] || {};
                                    const share = percent(item.total, total);
                                    return (
                                        <tr key={source.code}>
                                            <td>
                                                <span className="consult-source-name">
                                                    <i className={`consult-dot consult-src-${source.code}`} />
                                                    {item.libelle || source.libelle}
                                                </span>
                                            </td>
                                            {ACTION_KEYS.map((key) => (
                                                <td key={key}>
                                                    {formatNumber(item[key])}
                                                    <small className="consult-cell-pct">{percent(item[key], item.total)} %</small>
                                                </td>
                                            ))}
                                            <td><b>{formatNumber(item.total)}</b></td>
                                            <td className="consult-share-cell">
                                                <div className="stats-bar-track">
                                                    <span
                                                        className={`stats-bar-fill consult-src-${source.code}`}
                                                        style={{ width: `${share}%` }}
                                                    />
                                                </div>
                                                <small>{share} %</small>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td>Total</td>
                                    {ACTION_KEYS.map((key) => <td key={key}>{formatNumber(actionTotals[key])}</td>)}
                                    <td>{formatNumber(total)}</td>
                                    <td>100 %</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </section>

                {/* Top ressources */}
                <section className="consult-top-grid">
                    {sources.map((source) => {
                        const items = stats?.top_ressources?.[source.code] || [];
                        const max = Math.max(...items.map((item) => Number(item.consultations) || 0), 1);
                        return (
                            <article className="stats-panel" key={source.code}>
                                <div className="stats-panel-heading">
                                    <span>
                                        <i className={`consult-dot consult-src-${source.code}`} />
                                        Top fiches — {source.libelle}
                                    </span>
                                    <LuListOrdered />
                                </div>
                                {items.length === 0 ? (
                                    <div className="stats-empty-mini">Aucune fiche consultée sur cette période.</div>
                                ) : (
                                    <ol className="consult-top-list">
                                        {items.map((item, index) => (
                                            <li key={item.ressource_id}>
                                                <span className="consult-rank">{index + 1}</span>
                                                <div className="consult-top-body">
                                                    <div className="consult-top-line">
                                                        <button
                                                            type="button"
                                                            className="consult-link"
                                                            onClick={() => navigate(getResourceUrl(source.code, item.ressource_id))}
                                                            title="Ouvrir la fiche"
                                                        >
                                                            {item.ressource_id}
                                                            <LuExternalLink />
                                                        </button>
                                                        <b>{formatNumber(item.consultations)}</b>
                                                    </div>
                                                    <div className="stats-bar-track">
                                                        <span
                                                            className={`stats-bar-fill consult-src-${source.code}`}
                                                            style={{ width: `${Math.max((item.consultations / max) * 100, 3)}%` }}
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="consult-mini-link"
                                                        onClick={() => showResourceJournal(item.ressource_id)}
                                                    >
                                                        Voir le journal
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </article>
                        );
                    })}
                </section>

                {/* Journal détaillé */}
                <section className="stats-table-panel" id="consult-journal">
                    <div className="stats-table-heading">
                        <div>
                            <span><LuListOrdered /> Journal</span>
                            <h2>Liste détaillée des consultations</h2>
                        </div>
                        <strong>{formatNumber(journalCount)} consultation(s)</strong>
                    </div>

                    <form className="consult-journal-filters" onSubmit={applyJournalFilters}>
                        <label>
                            <span>Type</span>
                            <select
                                value={journalFilters.action}
                                onChange={(event) => setJournalFilters((f) => ({ ...f, action: event.target.value }))}
                            >
                                <option value="">Tous les types</option>
                                {CONSULTATION_ACTIONS.map((action) => (
                                    <option key={action.code} value={action.code}>{action.libelle}</option>
                                ))}
                            </select>
                        </label>
                        <label className="stats-search-field">
                            <span>Identifiant de ressource</span>
                            <LuSearch />
                            <input
                                type="search"
                                value={journalFilters.ressource_id}
                                placeholder="ex. 13, W651814542, hal-01234567"
                                onChange={(event) => setJournalFilters((f) => ({ ...f, ressource_id: event.target.value }))}
                            />
                        </label>
                        <label>
                            <span>Lignes par page</span>
                            <select
                                value={pageSize}
                                onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
                            >
                                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                            </select>
                        </label>
                        <div className="consult-journal-buttons">
                            <button type="submit" className="stats-apply-btn">
                                <LuFilter /> Filtrer
                            </button>
                            <button type="button" className="stats-back-btn" onClick={resetJournalFilters}>
                                Réinitialiser
                            </button>
                        </div>
                    </form>

                    {journalError && <div className="stats-alert" role="alert">{journalError}</div>}

                    {journalLoading ? (
                        <div className="stats-loading"><span className="loading-spinner" />Chargement des consultations...</div>
                    ) : !journal?.results?.length ? (
                        <div className="stats-empty-state">
                            <LuEye />
                            <h3>Aucune consultation trouvée</h3>
                            <p>Essayez une autre période, une autre source ou un autre type.</p>
                        </div>
                    ) : (
                        <>
                            <div className="stats-table-wrap">
                                <table className="stats-table">
                                    <thead>
                                        <tr>
                                            <th>Date et heure</th>
                                            <th>Source</th>
                                            <th>Type</th>
                                            <th>Ressource</th>
                                            <th>Utilisateur</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {journal.results.map((row) => (
                                            <tr key={row.id}>
                                                <td>{formatDateTime(row.date)}</td>
                                                <td>
                                                    <span className="consult-source-name">
                                                        <i className={`consult-dot consult-src-${row.source}`} />
                                                        {row.source_libelle || getSourceLabel(row.source)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`consult-action-pill consult-act-${row.action}`}>
                                                        {row.action_libelle || ACTION_SHORT_LABELS[row.action] || row.action}
                                                    </span>
                                                </td>
                                                <td>
                                                    {row.ressource_id ? (
                                                        <button
                                                            type="button"
                                                            className="consult-link"
                                                            onClick={() => navigate(getResourceUrl(row.source, row.ressource_id))}
                                                        >
                                                            {row.ressource_id}
                                                            <LuExternalLink />
                                                        </button>
                                                    ) : '—'}
                                                </td>
                                                <td>
                                                    {row.utilisateur_id
                                                        ? `Utilisateur #${row.utilisateur_id}`
                                                        : <span className="consult-muted">Visiteur non connecté</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="consult-pagination">
                                <button
                                    type="button"
                                    className="stats-back-btn"
                                    disabled={!journal.previous || page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    <LuChevronLeft /> Précédent
                                </button>
                                <span>Page {page} / {totalPages}</span>
                                <button
                                    type="button"
                                    className="stats-back-btn"
                                    disabled={!journal.next}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    Suivant <LuChevronRight />
                                </button>
                            </div>
                        </>
                    )}
                </section>
            </main>
        </div>
    );
}

export default StatistiquesConsultationsPage;
