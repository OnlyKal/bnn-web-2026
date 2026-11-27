import React, { useEffect, useState } from 'react';
import { FaCheck, FaCopy, FaLink, FaSearch, FaShareAlt, FaTimes, FaUserMinus, FaUserPlus, FaUsers } from 'react-icons/fa';
import { salonsAPI } from '../api';
import { extractList, initials, personName } from './salonUtils';
import VisibilityBadge from './VisibilityBadge';
import { Modal } from './SalonUi';

/** Fenêtre « Inviter des personnes » : recherche, sélection, puis envoi des invitations. */
const InviteModal = ({ open, salonId, salonTitle, memberIds, onClose, onDone, onError }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selected, setSelected] = useState([]);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!open) {
            setQuery('');
            setResults([]);
            setSelected([]);
        }
    }, [open]);

    useEffect(() => {
        if (!open || query.trim().length < 2) {
            setResults([]);
            return undefined;
        }
        const timer = setTimeout(async () => {
            try {
                setSearching(true);
                setResults(extractList(await salonsAPI.searchUsers(query.trim())));
            } catch (error) {
                onError(error.message);
            } finally {
                setSearching(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [open, query, onError]);

    const isSelected = (user) => selected.some((u) => u.id === user.id);
    const toggle = (user) => setSelected((current) => (
        isSelected(user) ? current.filter((u) => u.id !== user.id) : [...current, user]
    ));

    const send = async () => {
        if (!selected.length) return;
        try {
            setSending(true);
            const response = await salonsAPI.invite(salonId, selected.map((u) => u.id));
            onDone(response.message);
            onClose();
        } catch (error) {
            onError(error.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <Modal
            open={open}
            title="Inviter des personnes"
            onClose={onClose}
            size="lg"
            labelledBy="salon-invite-title"
            footer={(
                <>
                    <button type="button" className="salons-secondary-btn" onClick={onClose}>Annuler</button>
                    <button type="button" className="salons-primary-btn salon-dialog-confirm" onClick={send} disabled={!selected.length || sending}>
                        <FaUserPlus /> {sending ? 'Envoi…' : `Inviter${selected.length ? ` (${selected.length})` : ''}`}
                    </button>
                </>
            )}
        >
            <p className="salon-invite-intro">Les personnes invitées recevront une notification pour rejoindre « {salonTitle} ».</p>
            <div className="salon-invite-search">
                <FaSearch />
                <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Nom, prénom ou identifiant (2 lettres min.)"
                    autoFocus
                />
            </div>
            {selected.length > 0 && (
                <div className="salon-invite-chips">
                    {selected.map((user) => (
                        <span key={user.id} className="salon-invite-chip">
                            {personName(user)}
                            <button type="button" aria-label={`Retirer ${personName(user)}`} onClick={() => toggle(user)}><FaTimes /></button>
                        </span>
                    ))}
                </div>
            )}
            <div className="salon-invite-results-modal">
                {searching && <div className="salons-muted">Recherche…</div>}
                {!searching && query.trim().length >= 2 && results.length === 0 && (
                    <div className="salons-muted">Aucune personne trouvée</div>
                )}
                {query.trim().length < 2 && <div className="salons-muted">Tapez au moins 2 lettres pour chercher.</div>}
                {results.map((user) => {
                    const already = memberIds.includes(user.id);
                    return (
                        <label key={user.id} className={`salon-invite-row ${isSelected(user) ? 'selected' : ''} ${already ? 'disabled' : ''}`}>
                            <input type="checkbox" checked={isSelected(user)} disabled={already} onChange={() => toggle(user)} />
                            <span className="salon-member-avatar">{initials(user)}</span>
                            <span className="salon-invite-name">
                                <strong>{personName(user)}</strong>
                                <small>@{user.username}{already ? ' · déjà membre' : ''}</small>
                            </span>
                        </label>
                    );
                })}
            </div>
        </Modal>
    );
};

/** Lien d'invitation généré par le serveur : les personnes qui le suivent entrent dans le salon. */
const InvitationLinkBox = ({ salon, onInfo, onError }) => {
    const [link, setLink] = useState('');
    const salonId = salon.id;

    useEffect(() => {
        let active = true;
        setLink('');
        salonsAPI.getInvitationLink(salonId)
            .then((response) => {
                const token = response?.data?.token;
                if (active && token) setLink(`${window.location.origin}/salons?invitation=${encodeURIComponent(token)}`);
            })
            .catch((error) => active && onError(error.message));
        return () => { active = false; };
    }, [salonId, onError]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            onInfo("Lien d'invitation copié.");
        } catch {
            onError('Copie impossible : sélectionnez le lien et copiez-le.');
        }
    };

    const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    const share = async () => {
        try {
            await navigator.share({ title: salon.titre, text: `Rejoignez le salon « ${salon.titre} »`, url: link });
        } catch (error) {
            // Fermer la fenêtre de partage n'est pas une erreur.
            if (error?.name !== 'AbortError') copy();
        }
    };

    return (
        <div className="salon-link-share">
            <div className="salon-link-share-title"><FaLink /> Inviter avec un lien</div>
            <div className="salon-link-share-actions">
                <button type="button" className="salons-primary-btn" onClick={copy} disabled={!link}>
                    <FaCopy /> {link ? 'Copier le lien' : 'Création du lien…'}
                </button>
                {canShare && (
                    <button type="button" className="salons-secondary-btn" onClick={share} disabled={!link}>
                        <FaShareAlt /> Partager
                    </button>
                )}
            </div>
            <small className="salons-muted">Les personnes qui suivent ce lien rejoignent le salon.</small>
        </div>
    );
};

const MembersPanel = ({ salon, members, requests, invites, isCreator, onAction, onInfo, onError, confirm = async () => true }) => {
    const [showInvite, setShowInvite] = useState(false);
    const isPrivate = salon?.visibilite === 'prive';
    // Le créateur partage toujours le lien ; dans un salon public, chaque membre peut aussi le partager.
    const canShareLink = !!salon && !salon.ferme && (isCreator || (salon.est_membre && !isPrivate));
    // Les membres en ligne d'abord, puis par ordre alphabétique.
    const sortedMembers = [...members].sort((a, b) => (
        (b.en_ligne ? 1 : 0) - (a.en_ligne ? 1 : 0)
        || personName(a.utilisateur).localeCompare(personName(b.utilisateur), 'fr')
    ));
    const onlineCount = members.filter((m) => m.en_ligne).length;

    if (!salon) {
        return (
            <div className="salons-left-members">
                <div className="salons-left-members-header"><h3><FaUsers /> Membres du salon</h3></div>
                <div className="salons-left-members-empty">Sélectionnez un salon</div>
            </div>
        );
    }

    return (
        <div className="salons-left-members">
            {/* Lien à copier ou partager, juste au-dessus des membres. */}
            {canShareLink && <InvitationLinkBox salon={salon} onInfo={onInfo} onError={onError} />}
            <div className="salons-left-members-header">
                <h3><FaUsers /> Membres du salon</h3>
                <span>{salon.membres_count || members.length || 0}</span>
            </div>
            {/* Rappelle de quel salon il s'agit, pour ne pas le confondre avec les autres. */}
            <div className="salon-members-current">
                <strong>{salon.titre}</strong>
                <VisibilityBadge salon={salon} />
            </div>

            {/* Salon public : on peut aussi inviter des personnes par leur nom. Salon privé : le lien suffit. */}
            {isCreator && !isPrivate && !salon.ferme && (
                <button type="button" className="salons-secondary-btn salon-invite-toggle" onClick={() => setShowInvite(true)}>
                    <FaUserPlus /> Inviter des personnes
                </button>
            )}
            <InviteModal
                open={isCreator && showInvite && !isPrivate && !salon.ferme}
                salonId={salon.id}
                salonTitle={salon.titre}
                memberIds={members.map((m) => m.utilisateur?.id)}
                onClose={() => setShowInvite(false)}
                onDone={(message) => { onInfo(message); onAction(); }}
                onError={onError}
            />

            {isCreator && requests.length > 0 && (
                <div className="salon-requests">
                    <h4>Demandes d'adhésion ({requests.length})</h4>
                    {requests.map((request) => (
                        <div className="salons-left-member" key={request.id}>
                            <span>{initials(request.utilisateur)}</span>
                            <strong>{personName(request.utilisateur)}</strong>
                            {!salon.ferme && <button type="button" title="Accepter" onClick={() => onAction(request.utilisateur.id, 'accepter')}><FaCheck /></button>}
                            <button type="button" title="Refuser" onClick={() => onAction(request.utilisateur.id, 'refuser')}><FaTimes /></button>
                        </div>
                    ))}
                </div>
            )}

            {!salon.est_membre && !isCreator && (
                <div className="salons-left-members-empty">Rejoignez le salon pour voir ses membres</div>
            )}
            {(salon.est_membre || isCreator) && members.length === 0 && (
                <div className="salons-left-members-empty">Aucun membre affiché</div>
            )}
            {members.length > 0 && (
                <div className="salons-left-members-list">
                    {onlineCount > 0 && <div className="salon-online-count">{onlineCount} en ligne</div>}
                    {sortedMembers.map((member) => (
                        <div className={`salons-left-member ${member.en_ligne ? 'online' : ''}`} key={member.id}>
                            <span className="salon-member-avatar" title={member.en_ligne ? 'En ligne' : 'Hors ligne'}>
                                {initials(member.utilisateur)}
                                {member.en_ligne && <i className="salon-online-dot" aria-label="En ligne" />}
                            </span>
                            <strong>
                                {personName(member.utilisateur)}
                                {member.est_createur && <small className="salon-role-tag">Créateur</small>}
                            </strong>
                            {isCreator && !member.est_createur && (
                                <button
                                    type="button"
                                    title="Retirer du salon"
                                    onClick={async () => {
                                        const ok = await confirm({
                                            title: 'Retirer ce membre ?',
                                            message: `${personName(member.utilisateur)} ne pourra plus lire ni écrire dans le salon, ni le rejoindre à nouveau.`,
                                            confirmLabel: 'Retirer du salon',
                                            danger: true
                                        });
                                        if (ok) onAction(member.utilisateur.id, 'retirer');
                                    }}
                                >
                                    <FaUserMinus />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {isCreator && invites.length > 0 && (
                <div className="salon-requests">
                    <h4>Invitations en attente ({invites.length})</h4>
                    {invites.map((invite) => (
                        <div className="salons-left-member" key={invite.id}>
                            <span>{initials(invite.utilisateur)}</span>
                            <strong>{personName(invite.utilisateur)}</strong>
                            <button type="button" title="Annuler l'invitation" onClick={() => onAction(invite.utilisateur.id, 'annuler-invitation')}><FaTimes /></button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MembersPanel;
