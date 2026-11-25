// Connexion WebSocket aux salons, avec reconnexion automatique.
// Les messages sont envoyés par l'API REST ; le WebSocket sert à les recevoir en direct.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSession } from '../utils/auth';
import { getSocketUrl } from './salonUtils';

const MAX_DELAY = 30000;

const rawToken = () => {
    const { token } = getSession();
    if (!token) return null;
    return token.replace(/^(Bearer|Token)\s+/i, '');
};

export default function useSalonSocket(onEvent) {
    const [connected, setConnected] = useState(false);
    const socketRef = useRef(null);
    const subscriptionsRef = useRef(new Set());
    const handlerRef = useRef(onEvent);
    const retryRef = useRef({ attempt: 0, timer: null, closed: false });

    useEffect(() => {
        handlerRef.current = onEvent;
    }, [onEvent]);

    const send = useCallback((payload) => {
        const socket = socketRef.current;
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(payload));
            return true;
        }
        return false;
    }, []);

    const connect = useCallback(() => {
        const token = rawToken();
        if (!token || typeof WebSocket === 'undefined') return;
        let socket;
        try {
            socket = new WebSocket(getSocketUrl(token));
        } catch {
            return;
        }
        socketRef.current = socket;

        socket.onopen = () => {
            retryRef.current.attempt = 0;
            setConnected(true);
            subscriptionsRef.current.forEach((salonId) => {
                socket.send(JSON.stringify({ action: 'subscribe', salon_id: salonId }));
            });
        };
        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handlerRef.current?.(data.event, data.payload || {});
            } catch {
                // Message illisible : ignoré.
            }
        };
        socket.onclose = (event) => {
            setConnected(false);
            socketRef.current = null;
            const retry = retryRef.current;
            // 4401 : jeton refusé, inutile de réessayer en boucle.
            if (retry.closed || event.code === 4401) return;
            const delay = Math.min(MAX_DELAY, 1000 * 2 ** retry.attempt);
            retry.attempt += 1;
            retry.timer = setTimeout(connect, delay);
        };
        socket.onerror = () => socket.close();
    }, []);

    useEffect(() => {
        const retry = retryRef.current;
        retry.closed = false;
        connect();
        const keepAlive = setInterval(() => send({ action: 'ping' }), 25000);
        return () => {
            retry.closed = true;
            clearTimeout(retry.timer);
            clearInterval(keepAlive);
            socketRef.current?.close();
        };
    }, [connect, send]);

    /** Suit exactement la liste de salons donnée (abonnements et désabonnements). */
    const followSalons = useCallback((salonIds) => {
        const wanted = new Set(salonIds.map(Number).filter(Boolean));
        const current = subscriptionsRef.current;
        current.forEach((id) => {
            if (!wanted.has(id)) send({ action: 'unsubscribe', salon_id: id });
        });
        wanted.forEach((id) => {
            if (!current.has(id)) send({ action: 'subscribe', salon_id: id });
        });
        subscriptionsRef.current = wanted;
    }, [send]);

    const sendTyping = useCallback((salonId) => send({ action: 'typing', salon_id: salonId }), [send]);

    return { connected, followSalons, sendTyping };
}
