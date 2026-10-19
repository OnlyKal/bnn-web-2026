import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LuArrowLeft,
    LuChartBar,
    LuCalendarDays,
    LuDownload,
    LuFilePenLine,
    LuFileText,
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
import logoBnnUrl from './Images/Logo_BBN.png';

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

const formatInputDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

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
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    const date = dateOnlyMatch
        ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
        : new Date(value);
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
const isCanceledRequest = (error) => error.code === 'ERR_CANCELED' || error.name === 'CanceledError';
const getLocalDateKey = (value) => {
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    if (dateOnlyMatch) return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'unknown';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const getUserTotals = (rows) => {
    const users = new Map();
    rows.forEach((row) => {
        const key = String(row.userId || row.userLabel);
        const user = users.get(key) || {
            label: row.userLabel,
            insertions: 0,
            modifications: 0
        };
        user[row.actionType === 'insertion' ? 'insertions' : 'modifications'] += row.count;
        users.set(key, user);
    });

    return Array.from(users.values())
        .sort((a, b) => (b.insertions + b.modifications) - (a.insertions + a.modifications));
};

const institutionHeader = [
    'REPUBLIQUE DEMOCRATIQUE DU CONGO',
    "MINISTERE DE L'ESURSI",
    'BIBLIOTHEQUE NUMERIQUE NATIONALE'
];

function StatistiquesActionsPage() {
    const navigate = useNavigate();
    const defaultDates = useMemo(getDefaultDates, []);
    const [filters, setFilters] = useState({
        date_debut: defaultDates.dateDebut,
        date_fin: defaultDates.dateFin,
        utilisateur_id: '',
        type_action: 'tous',
        search: ''
    });
    const [appliedDates, setAppliedDates] = useState({
        date_debut: defaultDates.dateDebut,
        date_fin: defaultDates.dateFin
    });
    const [statsData, setStatsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [exportError, setExportError] = useState('');
    const [exportingFormat, setExportingFormat] = useState('');
    const [selectedStatsRow, setSelectedStatsRow] = useState(null);

    useEffect(() => {
        const controller = new AbortController();

        const fetchStats = async () => {
            setLoading(true);
            setError('');

            try {
                const params = {
                    group_by: 'utilisateur_date',
                    date_debut: appliedDates.date_debut,
                    date_fin: appliedDates.date_fin
                };

                const response = await ressourcesStatsAPI.getActionsStats(params, {
                    signal: controller.signal
                });
                setStatsData(response);
            } catch (err) {
                if (controller.signal.aborted || isCanceledRequest(err)) return;
                setError(err.message || 'Erreur lors du chargement des statistiques');
                setStatsData(null);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        fetchStats();
        return () => controller.abort();
    }, [appliedDates]);

    const rows = useMemo(() => normalizeActionRows(statsData), [statsData]);

    const userOptions = useMemo(() => {
        const users = new Map();
        rows.forEach((row) => {
            if (!row.userId) return;
            const key = String(row.userId);
            if (!users.has(key)) users.set(key, { id: key, label: row.userLabel });
        });
        return Array.from(users.values())
            .filter((user) => user.id)
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [rows]);

    const filteredRows = useMemo(() => {
        const query = filters.search.trim().toLowerCase();

        return rows.filter((row) => {
            const userKey = row.userId || row.userLabel;
            const matchesUser = !filters.utilisateur_id || String(userKey) === String(filters.utilisateur_id);
            const matchesType = filters.type_action === 'tous' || row.actionType === filters.type_action;
            const matchesSearch = !query ||
                row.userLabel.toLowerCase().includes(query) ||
                [row.resource, ...row.resources.map((resource) => resource.title)]
                    .some((resource) => String(resource).toLowerCase().includes(query)) ||
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

        return { insertions, modifications };
    }, [filteredRows]);
    const userTotals = useMemo(() => getUserTotals(filteredRows), [filteredRows]);

    const userChart = useMemo(() => {
        const grouped = new Map();
        filteredRows.forEach((row) => {
            const key = row.userId || row.userLabel;
            const current = grouped.get(key) || { label: row.userLabel, value: 0 };
            grouped.set(key, { ...current, value: current.value + row.count });
        });

        return Array.from(grouped, ([key, user]) => ({ key, ...user }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [filteredRows]);

    const periodChart = useMemo(() => {
        const grouped = new Map();
        filteredRows.forEach((row) => {
            const key = getLocalDateKey(row.date);
            const label = key === 'unknown' ? 'Date inconnue' : formatDate(key);
            const current = grouped.get(key) || { label, value: 0 };
            grouped.set(key, { ...current, value: current.value + row.count });
        });

        return Array.from(grouped, ([key, period]) => ({ key, ...period }))
            .sort((a, b) => a.key.localeCompare(b.key));
    }, [filteredRows]);

    const typeChart = [
        { label: 'Ajouts', value: totals.insertions, className: 'add' },
        { label: 'Modifications', value: totals.modifications, className: 'edit' }
    ];

    const totalActions = totals.insertions + totals.modifications;
    const activeUsers = new Set(filteredRows.map((row) => row.userId || row.userLabel)).size;

    const handleFilterChange = (event) => {
        const { name, value } = event.target;
        setFilters((current) => ({
            ...current,
            [name]: value
        }));
    };

    const applyFilters = (event) => {
        event.preventDefault();
        if (!filters.date_debut || !filters.date_fin || filters.date_debut > filters.date_fin) return;
        setAppliedDates({
            date_debut: filters.date_debut,
            date_fin: filters.date_fin
        });
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
            search: ''
        });
        setAppliedDates({
            date_debut: defaultDates.dateDebut,
            date_fin: defaultDates.dateFin
        });
    };

    const exportExcel = async () => {
        setExportingFormat('excel');
        setExportError('');

        try {
            const [{ default: ExcelJS }, logoResponse] = await Promise.all([
                import('exceljs'),
                fetch(logoBnnUrl)
            ]);
            if (!logoResponse.ok) throw new Error('Le logo du rapport n’a pas pu être chargé.');

            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Bibliothèque Numérique Nationale';
            workbook.created = new Date();
            workbook.modified = new Date();

            const logoBuffer = await logoResponse.arrayBuffer();
            const logoId = workbook.addImage({ buffer: logoBuffer, extension: 'png' });
            const navy = '073B70';
            const titleFont = { bold: true, size: 18, color: { argb: `FF${navy}` } };
            const periodLabel = `Période : ${formatDate(appliedDates.date_debut)} – ${formatDate(appliedDates.date_fin)}`;
            const generatedAt = `Généré le ${new Date().toLocaleString('fr-FR')}`;
            const userRows = userTotals.map((user) => [
                    user.label,
                    user.insertions,
                    user.modifications,
                    user.insertions + user.modifications
                ]);
            const drawInstitutionHeader = (worksheet, lastColumn) => {
                worksheet.addImage(logoId, {
                    tl: { col: 0, row: 0 },
                    ext: { width: 175, height: 74 }
                });
                for (let index = 0; index < institutionHeader.length; index += 1) {
                    const rowNumber = index + 1;
                    worksheet.mergeCells(`C${rowNumber}:${lastColumn}${rowNumber}`);
                    const cell = worksheet.getCell(`C${rowNumber}`);
                    cell.value = institutionHeader[index];
                    cell.font = {
                        bold: true,
                        size: index === 2 ? 13 : 12,
                        color: { argb: `FF${navy}` }
                    };
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    worksheet.getRow(rowNumber).height = 24;
                }
            };

            const summary = workbook.addWorksheet('Synthèse', {
                properties: { tabColor: navy },
                views: [{ state: 'frozen', ySplit: 9 }]
            });
            summary.columns = [
                { width: 24 },
                { width: 18 },
                { width: 20 },
                { width: 18 },
                { width: 16 },
                { width: 16 }
            ];
            drawInstitutionHeader(summary, 'F');
            summary.mergeCells('A5:F5');
            summary.getCell('A5').value = 'RAPPORT STATISTIQUE DES ACTIONS';
            summary.getCell('A5').font = titleFont;
            summary.getCell('A5').alignment = { vertical: 'middle', horizontal: 'center' };
            summary.getRow(5).height = 32;
            summary.mergeCells('A6:F6');
            summary.getCell('A6').value = periodLabel;
            summary.getCell('A6').font = { bold: true, color: { argb: `FF${navy}` } };
            summary.getCell('A6').alignment = { horizontal: 'center' };
            summary.mergeCells('A7:F7');
            summary.getCell('A7').value = generatedAt;
            summary.getCell('A7').font = { italic: true, color: { argb: 'FF667085' } };
            summary.getCell('A7').alignment = { horizontal: 'center' };

            summary.addTable({
                name: 'TotauxGeneraux',
                ref: 'A9',
                headerRow: true,
                style: { theme: 'TableStyleMedium2', showRowStripes: true },
                columns: [{ name: 'Indicateur' }, { name: 'Total' }],
                rows: [
                    ['Ajouts', totals.insertions],
                    ['Modifications', totals.modifications],
                    ['Actions analysées', totalActions],
                    ['Utilisateurs actifs', activeUsers]
                ]
            });
            summary.mergeCells('A15:F15');
            summary.getCell('A15').value = 'TOTAUX PAR UTILISATEUR';
            summary.getCell('A15').font = titleFont;
            summary.getCell('A15').alignment = { vertical: 'middle' };
            summary.getRow(15).height = 28;
            summary.addTable({
                name: 'TotauxParUtilisateur',
                ref: 'A16',
                headerRow: true,
                style: { theme: 'TableStyleMedium2', showRowStripes: true },
                columns: [
                    { name: 'Utilisateur' },
                    { name: 'Ajouts' },
                    { name: 'Modifications' },
                    { name: 'Total actions' }
                ],
                rows: userRows
            });

            const details = workbook.addWorksheet('Détail', {
                properties: { tabColor: '28A745' },
                views: [{ state: 'frozen', ySplit: 9 }]
            });
            details.columns = [
                { width: 20 },
                { width: 30 },
                { width: 14 },
                { width: 20 },
                { width: 16 },
                { width: 54 }
            ];
            drawInstitutionHeader(details, 'F');
            details.mergeCells('A5:F5');
            details.getCell('A5').value = 'JOURNAL DETAILLE DES AJOUTS ET MODIFICATIONS';
            details.getCell('A5').font = titleFont;
            details.getCell('A5').alignment = { vertical: 'middle', horizontal: 'center' };
            details.getRow(5).height = 32;
            details.mergeCells('A6:F6');
            details.getCell('A6').value = periodLabel;
            details.getCell('A6').font = { bold: true, color: { argb: `FF${navy}` } };
            details.mergeCells('A7:F7');
            details.getCell('A7').value = generatedAt;
            details.getCell('A7').font = { italic: true, color: { argb: 'FF667085' } };
            details.mergeCells('A8:F8');
            details.getCell('A8').value = `Filtres appliqués : ${filters.type_action === 'tous' ? 'Ajouts et modifications' : actionConfig[filters.type_action].pluralLabel}${filters.utilisateur_id ? ` — ${userOptions.find((user) => user.id === filters.utilisateur_id)?.label || 'Utilisateur sélectionné'}` : ''}${filters.search.trim() ? ` — Recherche : ${filters.search.trim()}` : ''}`;
            details.getCell('A8').font = { italic: true, color: { argb: 'FF667085' } };
            details.addTable({
                name: 'JournalActions',
                ref: 'A10',
                headerRow: true,
                style: { theme: 'TableStyleMedium2', showRowStripes: true },
                columns: [
                    { name: 'Action' },
                    { name: 'Utilisateur' },
                    { name: 'Nombre' },
                    { name: 'Date' },
                    { name: 'Heure' },
                    { name: 'Ressource(s)' }
                ],
                rows: filteredRows.map((row) => [
                    actionConfig[row.actionType].label,
                    row.userLabel,
                    row.count,
                    formatDate(row.date),
                    formatTime(row.time),
                    row.resources.length > 1
                        ? row.resources.map((resource) => resource.title).join(', ')
                        : row.resource
                ])
            });

            [summary, details].forEach((worksheet) => {
                worksheet.eachRow((row) => {
                    row.eachCell((cell) => {
                        cell.alignment = { ...cell.alignment, vertical: 'middle' };
                    });
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `rapport-statistique-${appliedDates.date_debut}-${appliedDates.date_fin}.xlsx`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            setExportError(err.message || 'Erreur lors de la génération du fichier Excel.');
        } finally {
            setExportingFormat('');
        }
    };

    const exportPdf = async () => {
        setExportingFormat('pdf');
        setExportError('');

        try {
            const [{ jsPDF }, autoTableModule, logoResponse] = await Promise.all([
                import('jspdf'),
                import('jspdf-autotable'),
                fetch(logoBnnUrl)
            ]);
            if (!logoResponse.ok) throw new Error('Le logo du rapport n’a pas pu être chargé.');

            const autoTable = autoTableModule.default;
            if (typeof autoTable !== 'function') throw new Error('Le module de création des tableaux PDF est indisponible.');

            const logoBlob = await logoResponse.blob();
            const logoData = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('Le logo du rapport n’a pas pu être lu.'));
                reader.readAsDataURL(logoBlob);
            });
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const navy = [7, 59, 112];
            const pdfNumber = (value) => formatNumber(value).replace(/[\u00a0\u202f]/g, ' ');
            const periodLabel = `Période : ${formatDate(appliedDates.date_debut)} - ${formatDate(appliedDates.date_fin)}`;
            const generatedAt = `Généré le ${new Date().toLocaleString('fr-FR')}`;
            const drawInstitutionHeader = () => {
                pdf.addImage(logoData, 'PNG', 14, 8, 43, 18);
                pdf.setTextColor(...navy);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(11);
                institutionHeader.forEach((line, index) => {
                    pdf.text(line, pageWidth / 2, 13 + index * 6, { align: 'center' });
                });
                pdf.setDrawColor(...navy);
                pdf.setLineWidth(0.5);
                pdf.line(14, 30, pageWidth - 14, 30);
            };
            const drawFooter = () => {
                const pageCount = pdf.internal.getNumberOfPages();
                for (let page = 1; page <= pageCount; page += 1) {
                    pdf.setPage(page);
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(8);
                    pdf.setTextColor(100);
                    pdf.text(
                        `Bibliothèque Numérique Nationale - Page ${page}/${pageCount}`,
                        pageWidth - 14,
                        pageHeight - 7,
                        { align: 'right' }
                    );
                }
            };

            drawInstitutionHeader();
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(16);
            pdf.setTextColor(...navy);
            pdf.text('RAPPORT STATISTIQUE DES ACTIONS', pageWidth / 2, 39, { align: 'center' });
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10);
            pdf.setTextColor(60);
            pdf.text(periodLabel, pageWidth / 2, 45, { align: 'center' });
            pdf.text(generatedAt, pageWidth / 2, 50, { align: 'center' });

            autoTable(pdf, {
                startY: 56,
                margin: { left: 14, right: 14, top: 38, bottom: 15 },
                head: [['Indicateur', 'Total']],
                body: [
                    ['Ajouts', pdfNumber(totals.insertions)],
                    ['Modifications', pdfNumber(totals.modifications)],
                    ['Actions analysées', pdfNumber(totalActions)],
                    ['Utilisateurs actifs', pdfNumber(activeUsers)]
                ],
                tableWidth: 100,
                theme: 'grid',
                headStyles: { fillColor: navy },
                styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5 },
                willDrawPage: drawInstitutionHeader
            });

            const userTableStart = pdf.lastAutoTable.finalY + 9;
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(11);
            pdf.setTextColor(...navy);
            pdf.text('TOTAUX PAR UTILISATEUR', 14, userTableStart);
            autoTable(pdf, {
                startY: userTableStart + 3,
                margin: { left: 14, right: 14, top: 44, bottom: 15 },
                head: [['Utilisateur', 'Ajouts', 'Modifications', 'Total actions']],
                body: userTotals.map((user) => [
                    user.label,
                    pdfNumber(user.insertions),
                    pdfNumber(user.modifications),
                    pdfNumber(user.insertions + user.modifications)
                ]),
                theme: 'striped',
                headStyles: { fillColor: navy },
                styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5 },
                willDrawPage: (data) => {
                    drawInstitutionHeader();
                    if (data.pageNumber > 1) {
                        pdf.setFont('helvetica', 'bold');
                        pdf.setFontSize(12);
                        pdf.setTextColor(...navy);
                        pdf.text('TOTAUX PAR UTILISATEUR (suite)', 14, 36);
                    }
                }
            });

            pdf.addPage();
            drawInstitutionHeader();
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(14);
            pdf.setTextColor(...navy);
            pdf.text('JOURNAL DETAILLE DES AJOUTS ET MODIFICATIONS', 14, 38);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            pdf.setTextColor(60);
            pdf.text(periodLabel, 14, 44);
            const appliedFilters = `Filtres : ${filters.type_action === 'tous' ? 'Ajouts et modifications' : actionConfig[filters.type_action].pluralLabel}${filters.utilisateur_id ? ` - ${userOptions.find((user) => user.id === filters.utilisateur_id)?.label || 'Utilisateur sélectionné'}` : ''}${filters.search.trim() ? ` - Recherche : ${filters.search.trim()}` : ''}`;
            pdf.text(appliedFilters, 14, 49, { maxWidth: pageWidth - 28 });
            autoTable(pdf, {
                startY: 54,
                margin: { left: 14, right: 14, top: 44, bottom: 15 },
                head: [['Action', 'Utilisateur', 'Nombre', 'Date', 'Heure', 'Ressource(s)']],
                body: filteredRows.map((row) => [
                    actionConfig[row.actionType].label,
                    row.userLabel,
                    pdfNumber(row.count),
                    formatDate(row.date),
                    formatTime(row.time),
                    row.resources.length > 1
                        ? row.resources.map((resource) => resource.title).join(', ')
                        : row.resource
                ]),
                theme: 'striped',
                headStyles: { fillColor: navy },
                styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
                columnStyles: { 5: { cellWidth: 72 } },
                willDrawPage: (data) => {
                    drawInstitutionHeader();
                    if (data.pageNumber > 1) {
                        pdf.setFont('helvetica', 'bold');
                        pdf.setFontSize(12);
                        pdf.setTextColor(...navy);
                        pdf.text('JOURNAL DETAILLE (suite)', 14, 36);
                    }
                }
            });

            drawFooter();
            pdf.save(`rapport-statistique-${appliedDates.date_debut}-${appliedDates.date_fin}.pdf`);
        } catch (err) {
            setExportError(err.message || 'Erreur lors de la génération du fichier PDF.');
        } finally {
            setExportingFormat('');
        }
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
                    <div className="stats-bar-row" key={item.key || item.label}>
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

    const invalidDateRange = !filters.date_debut || !filters.date_fin || filters.date_debut > filters.date_fin;

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
                    <div className="stats-export-actions">
                        <button
                            type="button"
                            className="stats-back-btn"
                            onClick={exportPdf}
                            disabled={filteredRows.length === 0 || Boolean(exportingFormat)}
                        >
                            <LuFileText className={exportingFormat === 'pdf' ? 'spinning' : ''} />
                            {exportingFormat === 'pdf' ? 'Création du PDF...' : 'Exporter PDF'}
                        </button>
                        <button
                            type="button"
                            className="stats-export-btn"
                            onClick={exportExcel}
                            disabled={filteredRows.length === 0 || Boolean(exportingFormat)}
                        >
                            <LuDownload className={exportingFormat === 'excel' ? 'spinning' : ''} />
                            {exportingFormat === 'excel' ? 'Création du fichier...' : 'Exporter Excel'}
                        </button>
                    </div>
                </section>

                <form className="stats-filters" onSubmit={applyFilters}>
                    <div className="stats-filter-heading">
                        <span><LuFilter /> Filtres</span>
                        <button type="button" onClick={resetFilters}>Réinitialiser</button>
                    </div>
                    <div className="stats-filter-grid">
                        <label>
                            <span>Date début</span>
                            <input
                                type="date"
                                name="date_debut"
                                value={filters.date_debut}
                                max={filters.date_fin || undefined}
                                onChange={handleFilterChange}
                            />
                        </label>
                        <label>
                            <span>Date fin</span>
                            <input
                                type="date"
                                name="date_fin"
                                value={filters.date_fin}
                                min={filters.date_debut || undefined}
                                onChange={handleFilterChange}
                            />
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
                    {invalidDateRange && (
                        <div className="stats-alert" role="alert">
                            La date de début doit être antérieure ou égale à la date de fin.
                        </div>
                    )}
                    <button type="submit" className="stats-apply-btn" disabled={loading || invalidDateRange}>
                        <LuRefreshCw className={loading ? 'spinning' : ''} />
                        {loading ? 'Chargement...' : 'Appliquer les filtres'}
                    </button>
                </form>

                {error && <div className="stats-alert">{error}</div>}
                {exportError && <div className="stats-alert" role="alert">{exportError}</div>}

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
