// Salle de réunion vidéo d'un salon (LiveKit auto-hébergé sur le serveur BNN).
// Chargée à la demande (React.lazy) : la page Salon ne télécharge rien de LiveKit tant
// que personne n'entre dans une réunion.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    CarouselLayout,
    ConnectionStateToast,
    FocusLayout,
    FocusLayoutContainer,
    GridLayout,
    LayoutContextProvider,
    LiveKitRoom,
    MediaDeviceMenu,
    ParticipantTile,
    RoomAudioRenderer,
    TrackToggle,
    useCreateLayoutContext,
    useDataChannel,
    useLocalParticipant,
    useParticipantAttributes,
    useParticipants,
    usePinnedTracks,
    useRoomContext,
    useTrackRefContext,
    useTracks
} from '@livekit/components-react';
import { DisconnectReason, RoomEvent, Track } from 'livekit-client';
import { FaComments, FaHandPaper, FaPhoneSlash, FaStop, FaTimes, FaUsers } from 'react-icons/fa';
import '@livekit/components-styles';
import './meeting.css';

const CHAT_TOPIC = 'bnn.chat';
const HAND = 'main';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const handRaised = (participant) => participant?.attributes?.[HAND] === 'levee';
const displayName = (participant) => participant?.name || participant?.identity || 'Participant';

/** Écran d'avant-réunion : choisir micro et caméra avant d'entrer. */
function PreJoin({ salonTitle, starting, joining, onJoin, onCancel }) {
    const [audio, setAudio] = useState(true);
    const [video, setVideo] = useState(false);
    return (
        <div className="bnn-meet-prejoin" role="dialog" aria-modal="true" aria-label="Rejoindre la réunion">
            <div className="bnn-meet-prejoin-card">
                <h2>{starting ? 'Démarrer une réunion' : 'Rejoindre la réunion'}</h2>
                <p>{salonTitle}</p>
                <label className="bnn-meet-switch">
                    <input type="checkbox" checked={audio} onChange={(e) => setAudio(e.target.checked)} />
                    <span>Micro activé en entrant</span>
                </label>
                <label className="bnn-meet-switch">
                    <input type="checkbox" checked={video} onChange={(e) => setVideo(e.target.checked)} />
                    <span>Caméra activée en entrant</span>
                </label>
                <small>Le navigateur vous demandera l'autorisation d'utiliser le micro et la caméra.</small>
                <div className="bnn-meet-prejoin-actions">
                    <button type="button" className="salons-secondary-btn" onClick={onCancel}>Annuler</button>
                    <button type="button" className="salons-primary-btn" disabled={joining} onClick={() => onJoin({ audio, video })}>
                        {joining ? 'Connexion…' : starting ? 'Démarrer' : 'Rejoindre'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/** Vignette d'un participant, avec la main levée. */
function Tile(props) {
    const trackRef = useTrackRefContext();
    const { attributes } = useParticipantAttributes({ participant: trackRef?.participant });
    return (
        <div className="bnn-meet-tile">
            <ParticipantTile {...props} />
            {attributes?.[HAND] === 'levee' && (
                <span className="bnn-meet-hand" title="Main levée"><FaHandPaper /></span>
            )}
        </div>
    );
}

/** Grille des participants, ou partage d'écran en grand avec les vignettes à côté. */
function Stage() {
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false }
        ],
        { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false }
    );
    const layoutContext = useCreateLayoutContext();
    const pinned = usePinnedTracks(layoutContext);
    const screenShare = tracks.find((t) => t.source === Track.Source.ScreenShare && t.publication?.isSubscribed !== false);
    const focus = pinned?.[0] || screenShare;
    const others = focus ? tracks.filter((t) => t !== focus && !(t.participant === focus.participant && t.source === focus.source)) : tracks;

    return (
        <LayoutContextProvider value={layoutContext}>
            <div className="bnn-meet-stage">
                {focus ? (
                    <FocusLayoutContainer>
                        <CarouselLayout tracks={others}>
                            <Tile />
                        </CarouselLayout>
                        <FocusLayout trackRef={focus} />
                    </FocusLayoutContainer>
                ) : (
                    <GridLayout tracks={tracks}>
                        <Tile />
                    </GridLayout>
                )}
            </div>
        </LayoutContextProvider>
    );
}

function ChatPanel({ messages, onSend, onClose }) {
    const [text, setText] = useState('');
    const listRef = useRef(null);
    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }, [messages]);
    const submit = (e) => {
        e.preventDefault();
        const value = text.trim();
        if (!value) return;
        onSend(value);
        setText('');
    };
    return (
        <aside className="bnn-meet-side" aria-label="Discussion de la réunion">
            <header>
                <strong>Discussion</strong>
                <button type="button" onClick={onClose} aria-label="Fermer la discussion"><FaTimes /></button>
            </header>
            <div className="bnn-meet-chat-list" ref={listRef}>
                {messages.length === 0 && <p className="bnn-meet-muted">Les messages ne sont visibles que pendant la réunion.</p>}
                {messages.map((m) => (
                    <div key={m.id} className={`bnn-meet-chat-msg ${m.moi ? 'moi' : ''}`}>
                        <span>{m.moi ? 'Vous' : m.nom} · {new Date(m.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                        <p>{m.texte}</p>
                    </div>
                ))}
            </div>
            <form className="bnn-meet-chat-form" onSubmit={submit}>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Écrire un message…" maxLength={1000} />
                <button type="submit" className="salons-primary-btn">Envoyer</button>
            </form>
        </aside>
    );
}

function PeoplePanel({ onClose }) {
    const participants = useParticipants();
    const sorted = [...participants].sort((a, b) => Number(handRaised(b)) - Number(handRaised(a)));
    return (
        <aside className="bnn-meet-side" aria-label="Participants">
            <header>
                <strong>Participants ({participants.length})</strong>
                <button type="button" onClick={onClose} aria-label="Fermer la liste"><FaTimes /></button>
            </header>
            <ul className="bnn-meet-people">
                {sorted.map((p) => (
                    <li key={p.identity}>
                        <span>{displayName(p)}{p.isLocal ? ' (vous)' : ''}</span>
                        <span className="bnn-meet-people-state">
                            {handRaised(p) && <FaHandPaper title="Main levée" className="bnn-meet-hand-inline" />}
                            {p.isMicrophoneEnabled ? '🎙️' : '🔇'}
                        </span>
                    </li>
                ))}
            </ul>
        </aside>
    );
}

function Meeting({ salonTitle, canEnd, onLeave, onEndForAll, notify }) {
    const room = useRoomContext();
    const { localParticipant } = useLocalParticipant();
    const participants = useParticipants();
    const [panel, setPanel] = useState(null);
    const [messages, setMessages] = useState([]);
    const [unread, setUnread] = useState(0);
    const panelRef = useRef(panel);
    panelRef.current = panel;
    const myHand = handRaised(localParticipant);

    const onData = useCallback((msg) => {
        try {
            const data = JSON.parse(decoder.decode(msg.payload));
            if (!data?.texte) return;
            setMessages((list) => [...list, {
                id: data.id || `${Date.now()}-${Math.random()}`,
                texte: String(data.texte).slice(0, 1000),
                ts: data.ts || Date.now(),
                nom: displayName(msg.from),
                moi: false
            }].slice(-200));
            if (panelRef.current !== 'chat') setUnread((n) => n + 1);
        } catch {
            // Message illisible : ignoré.
        }
    }, []);
    const { send } = useDataChannel(CHAT_TOPIC, onData);

    const sendChat = useCallback((texte) => {
        const message = { id: `${room.localParticipant.identity}-${Date.now()}`, texte, ts: Date.now() };
        send(encoder.encode(JSON.stringify(message)), { reliable: true }).catch(() => notify?.("Message non envoyé"));
        setMessages((list) => [...list, { ...message, moi: true, nom: 'Vous' }].slice(-200));
    }, [room, send, notify]);

    // Annonce des mains levées.
    useEffect(() => {
        const onAttributes = (changed, participant) => {
            if (!participant || participant.isLocal || !(HAND in changed)) return;
            if (changed[HAND] === 'levee') notify?.(`${displayName(participant)} lève la main`);
        };
        room.on(RoomEvent.ParticipantAttributesChanged, onAttributes);
        return () => room.off(RoomEvent.ParticipantAttributesChanged, onAttributes);
    }, [room, notify]);

    const toggleHand = () => {
        localParticipant.setAttributes({ [HAND]: myHand ? '' : 'levee' }).catch(() => notify?.('Impossible de lever la main'));
    };

    const togglePanel = (name) => {
        setPanel((current) => (current === name ? null : name));
        if (name === 'chat') setUnread(0);
    };

    return (
        <div className="bnn-meet" data-lk-theme="default">
            <header className="bnn-meet-header">
                <div>
                    <strong>{salonTitle}</strong>
                    <span>{participants.length} participant(s)</span>
                </div>
                {canEnd && (
                    <button type="button" className="bnn-meet-end" onClick={onEndForAll}>
                        <FaStop /> Terminer pour tous
                    </button>
                )}
            </header>
            <div className="bnn-meet-body">
                <Stage />
                {panel === 'chat' && <ChatPanel messages={messages} onSend={sendChat} onClose={() => setPanel(null)} />}
                {panel === 'people' && <PeoplePanel onClose={() => setPanel(null)} />}
            </div>
            <div className="bnn-meet-controls lk-control-bar">
                <div className="lk-button-group">
                    <TrackToggle source={Track.Source.Microphone} title="Micro" showIcon />
                    <div className="lk-button-group-menu"><MediaDeviceMenu kind="audioinput" title="Choisir le micro" /></div>
                </div>
                <div className="lk-button-group">
                    <TrackToggle source={Track.Source.Camera} title="Caméra" showIcon />
                    <div className="lk-button-group-menu"><MediaDeviceMenu kind="videoinput" title="Choisir la caméra" /></div>
                </div>
                {typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia && (
                    <TrackToggle source={Track.Source.ScreenShare} title="Partager l'écran" showIcon captureOptions={{ audio: true }} />
                )}
                <button type="button" className={`lk-button ${myHand ? 'bnn-meet-active' : ''}`} onClick={toggleHand} title={myHand ? 'Baisser la main' : 'Lever la main'}>
                    <FaHandPaper />
                </button>
                <button type="button" className={`lk-button ${panel === 'chat' ? 'bnn-meet-active' : ''}`} onClick={() => togglePanel('chat')} title="Discussion">
                    <FaComments />
                    {unread > 0 && <span className="bnn-meet-badge">{unread}</span>}
                </button>
                <button type="button" className={`lk-button ${panel === 'people' ? 'bnn-meet-active' : ''}`} onClick={() => togglePanel('people')} title="Participants">
                    <FaUsers />
                </button>
                <button type="button" className="lk-button lk-disconnect-button" onClick={onLeave} title="Quitter la réunion">
                    <FaPhoneSlash /> <span>Quitter</span>
                </button>
            </div>
            <RoomAudioRenderer />
            <ConnectionStateToast />
        </div>
    );
}

/**
 * Props :
 *  - salon : { id, titre }
 *  - session : { url, token, peut_terminer } renvoyé par POST /salons/<id>/reunion/ (null tant qu'on n'a pas cliqué)
 *  - starting : true si aucune réunion n'est en cours (libellés « Démarrer »)
 *  - onRequestJoin() : demande le jeton au serveur ; onClose() ; onEndForAll() ; notify(texte)
 */
export default function MeetingRoom({ salon, session, starting, onRequestJoin, onClose, onEndForAll, notify, onError }) {
    const [choices, setChoices] = useState(null);
    const [joining, setJoining] = useState(false);

    const join = async (selected) => {
        setJoining(true);
        try {
            await onRequestJoin();
            setChoices(selected);
        } catch {
            // L'erreur est déjà affichée par la page.
            onClose();
        } finally {
            setJoining(false);
        }
    };

    const options = useMemo(() => ({ adaptiveStream: true, dynacast: true }), []);

    if (!session || !choices) {
        return (
            <PreJoin
                salonTitle={salon?.titre}
                starting={starting}
                onJoin={join}
                onCancel={onClose}
                joining={joining}
            />
        );
    }

    return (
        <div className="bnn-meet-overlay">
            <LiveKitRoom
                serverUrl={session.url}
                token={session.token}
                connect
                audio={choices.audio}
                video={choices.video}
                options={options}
                onDisconnected={(reason) => {
                    if (reason === DisconnectReason.ROOM_DELETED) notify?.('La réunion a été terminée par le créateur du salon.');
                    else if (reason === DisconnectReason.PARTICIPANT_REMOVED) notify?.('Vous ne participez plus à cette réunion.');
                    else if (reason === DisconnectReason.DUPLICATE_IDENTITY) notify?.('Vous avez rejoint la réunion depuis un autre appareil.');
                    onClose();
                }}
                onError={(error) => onError?.(error?.message || 'Erreur de connexion à la réunion')}
                onMediaDeviceFailure={() => notify?.("Micro ou caméra indisponible : vérifiez l'autorisation du navigateur.")}
                className="bnn-meet-room"
            >
                <Meeting
                    salonTitle={salon?.titre}
                    canEnd={!!session.peut_terminer}
                    onLeave={onClose}
                    onEndForAll={onEndForAll}
                    notify={notify}
                />
            </LiveKitRoom>
        </div>
    );
}
