import React from 'react';
import { FaPaperPlane, FaPlus, FaSearch, FaUsers } from 'react-icons/fa';
import { CreateSalonForm } from './SalonForms';
import VisibilityBadge from './VisibilityBadge';
import { formatOuverture } from './salonUtils';

const FILTERS = [
    { id: '', label: 'Tous' },
    { id: 'mes_salons', label: 'Mes salons' },
    { id: 'publics', label: 'Publics' },
    { id: 'prives', label: 'Privés' },
    { id: 'fermes', label: 'Fermés' }
];

const membershipLabel = (salon) => {
    if (salon.est_membre) return 'Membre';
    if (salon.statut_membre === 'en_attente') return 'Demande envoyée';
    if (salon.statut_membre === 'invite') return 'Invitation reçue';
    return salon.visibilite === 'prive' ? 'Sur demande' : 'À rejoindre';
};

/** Salons auxquels on participe, séparés des autres pour ne pas les confondre. */
const isParticipant = (salon) => Boolean(salon.est_membre || salon.est_createur);
const SECTIONS = [
    { id: 'joined', label: 'Mes salons', match: isParticipant },
    { id: 'others', label: 'Autres salons', match: (salon) => !isParticipant(salon) }
];

const SalonList = ({
    salons,
    loading,
    selectedId,
    searchTerm,
    onSearch,
    filter,
    onFilter,
    closedCount = 0,
    showCreateForm,
    onToggleCreate,
    onCreate,
    onError,
    submitting,
    onSelect
}) => (
    <>
        <div className="salons-list-tools">
            <div className="salons-search-box">
                <FaSearch />
                <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => onSearch(event.target.value)}
                    placeholder="Rechercher un salon"
                />
            </div>
            <button className="salons-primary-btn" onClick={onToggleCreate}>
                <FaPlus />
                Nouveau
            </button>
        </div>

        <div className="salon-filter-tabs" role="tablist">
            {FILTERS.map((item) => (
                <button
                    key={item.id || 'tous'}
                    role="tab"
                    aria-selected={filter === item.id}
                    className={filter === item.id ? 'active' : ''}
                    onClick={() => onFilter(item.id)}
                >
                    {item.label}
                    {item.id === 'fermes' && closedCount > 0 && <span className="salon-filter-count">{closedCount}</span>}
                </button>
            ))}
        </div>

        {showCreateForm && <CreateSalonForm submitting={submitting} onSubmit={onCreate} onError={onError} />}

        <div className="salons-list">
            {loading && <div className="salons-empty-state">Chargement des salons…</div>}
            {!loading && salons.length === 0 && <div className="salons-empty-state">Aucun salon trouvé</div>}
            {!loading && SECTIONS.map((section) => {
                const items = salons.filter((salon) => section.match(salon));
                if (items.length === 0) return null;
                return (
                    <div className={`salon-list-section ${section.id}`} key={section.id}>
                        <div className="salon-list-section-title">{section.label} <span>{items.length}</span></div>
                        {items.map((salon) => {
                            const unread = salon.non_lus_count || 0;
                            const status = selectedId === salon.id ? 'active' : unread > 0 ? 'unread' : 'idle';
                            return (
                                <button
                                    key={salon.id}
                                    className={`salon-list-item ${selectedId === salon.id ? 'active' : ''}`}
                                    onClick={() => onSelect(salon)}
                                >
                                    <span className="salon-list-title-row">
                                        <span className={`salon-conversation-dot ${status}`} aria-hidden="true"></span>
                                        <span className="salon-list-title">{salon.titre}</span>
                                        {selectedId === salon.id && <span className="salon-badge salon-badge-current">En cours</span>}
                                        {salon.ferme && <span className="salon-badge salon-badge-closed">Fermé</span>}
                                        {salon.est_ouvert === false && (
                                            <span className="salon-badge salon-badge-opening" title="Heure d'ouverture (heure de Kinshasa)">
                                                Ouvre le {formatOuverture(salon.date_ouverture)}
                                            </span>
                                        )}
                                        {salon.est_nouveau && <span className="salon-badge salon-badge-new">Nouveau</span>}
                                        {unread > 0 && (
                                            <span className="salon-badge salon-badge-unread" aria-label={`${unread} message(s) non lu(s)`}>
                                                {unread > 99 ? '99+' : unread}
                                            </span>
                                        )}
                                    </span>
                                    <span className="salon-list-description">{salon.description}</span>
                                    <span className="salon-list-stats">
                                        <FaUsers /> {salon.membres_count || 0}
                                        <FaPaperPlane /> {salon.messages_count || 0}
                                        <VisibilityBadge salon={salon} />
                                        <span className={`salon-list-membership ${isParticipant(salon) ? 'joined' : ''}`}>{membershipLabel(salon)}</span>
                                        {salon.demandes_count > 0 && (
                                            <span className="salon-badge salon-badge-request">{salon.demandes_count} demande(s)</span>
                                        )}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    </>
);

export default SalonList;
