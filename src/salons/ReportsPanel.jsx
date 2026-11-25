import React from 'react';
import { FaCheck, FaTimes, FaTrash } from 'react-icons/fa';
import { formatShortDate, personName } from './salonUtils';

/** Signalements de messages, visibles par le créateur du salon. */
const ReportsPanel = ({ reports, onResolve, onDeleteMessage, onClose }) => (
    <div className="salon-side-panel">
        <div className="salon-share-header">
            <strong>Messages signalés ({reports.length})</strong>
            <button type="button" onClick={onClose} aria-label="Fermer"><FaTimes /></button>
        </div>
        {reports.length === 0 && <span className="salons-muted">Aucun signalement en attente.</span>}
        {reports.map((report) => (
            <div className="salon-report" key={report.id}>
                <p>
                    <strong>{personName(report.message.expediteur)}</strong> · {formatShortDate(report.message.date_envoi)}
                </p>
                <blockquote>{report.message.supprime ? 'Message déjà supprimé' : report.message.extrait || 'Pièce jointe'}</blockquote>
                <small>Signalé par {personName(report.auteur)}{report.motif ? ` : « ${report.motif} »` : ''}</small>
                <div>
                    {!report.message.supprime && (
                        <button type="button" className="salons-danger-btn" onClick={() => onDeleteMessage(report)}>
                            <FaTrash /> Supprimer le message
                        </button>
                    )}
                    <button type="button" className="salons-secondary-btn" onClick={() => onResolve(report)}>
                        <FaCheck /> Marquer comme traité
                    </button>
                </div>
            </div>
        ))}
    </div>
);

export default ReportsPanel;
