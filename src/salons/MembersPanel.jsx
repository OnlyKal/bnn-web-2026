import React, { useEffect, useState } from 'react';
import { FaCheck, FaTimes, FaUserMinus, FaUserPlus, FaUsers } from 'react-icons/fa';
import { salonsAPI } from '../api';
import { extractList, initials, personName } from './salonUtils';

const InviteBox = ({ salonId, onDone, onError }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [selected, setSelected] = useState([]);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);
            return undefined;
        }
        const timer = setTimeout(async () => {
            try {
                setResults(extractList(await salonsAPI.searchUsers(query.trim())));
            } catch (error) {
                onError(error.message);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query, onError]);

    const toggle = (user) => setSelected((current) => (
        current.some((u) => u.id === user.id) ? current.filter((u) => u.id !== user.id) : [...current, user]
    ));

    const send = async () => {
        if (!selected.length) return;
        try {
            setSending(true);
            const response = await salonsAPI.invite(salonId, selected.map((u) => u.id));
            onDone(response.message);
            setSelected([]);
            setQuery('');
        } catch (error) {
            onError(error.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="salon-invite-box">
            <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nom ou identifiant (2 lettres min.)"
            />
            {results.length > 0 && (
                <div className="salon-invite-results">
                    {results.map((user) => (
                        <label key={user.id}>
                            <input
                                type="checkbox"
                                checked={selected.some((u) => u.id === user.id)}
                                onChange={() => toggle(user)}
                            />
                            {personName(user)} <small>@{user.username}</small>
                        </label>
                    ))}
                </div>
            )}
            <button type="button" className="salons-primary-btn" onClick={send} disabled={!selected.length || sending}>
                <FaUserPlus /> Inviter {selected.length > 0 ? `(${selected.length})` : ''}
            </button>
        </div>
    );
};

const MembersPanel = ({ salon, members, requests, invites, isCreator, onAction, onInfo, onError }) => {
    const [showInvite, setShowInvite] = useState(false);

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
            <div className="salons-left-members-header">
                <h3><FaUsers /> Membres du salon</h3>
                <span>{salon.membres_count || members.length || 0}</span>
            </div>

            {isCreator && (
                <button type="button" className="salons-secondary-btn salon-invite-toggle" onClick={() => setShowInvite((v) => !v)}>
                    <FaUserPlus /> Inviter des personnes
                </button>
            )}
            {isCreator && showInvite && (
                <InviteBox salonId={salon.id} onDone={(message) => { onInfo(message); onAction(); }} onError={onError} />
            )}

            {isCreator && requests.length > 0 && (
                <div className="salon-requests">
                    <h4>Demandes d'adhésion ({requests.length})</h4>
                    {requests.map((request) => (
                        <div className="salons-left-member" key={request.id}>
                            <span>{initials(request.utilisateur)}</span>
                            <strong>{personName(request.utilisateur)}</strong>
                            <button type="button" title="Accepter" onClick={() => onAction(request.utilisateur.id, 'accepter')}><FaCheck /></button>
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
                    {members.map((member) => (
                        <div className="salons-left-member" key={member.id}>
                            <span>{initials(member.utilisateur)}</span>
                            <strong>
                                {personName(member.utilisateur)}
                                {member.est_createur && <small className="salon-role-tag">Créateur</small>}
                            </strong>
                            {isCreator && !member.est_createur && (
                                <button
                                    type="button"
                                    title="Retirer du salon"
                                    onClick={() => {
                                        if (window.confirm(`Retirer ${personName(member.utilisateur)} du salon ?`)) {
                                            onAction(member.utilisateur.id, 'retirer');
                                        }
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
