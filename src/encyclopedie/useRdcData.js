import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbort } from '../services/encyclopedieApi';

/**
 * Charge une ressource de l'encyclopédie et annule la requête précédente
 * quand les dépendances changent (navigation rapide, filtres…).
 */
const useRdcData = (loader, deps) => {
    const [state, setState] = useState({ data: null, loading: true, error: null });
    const [attempt, setAttempt] = useState(0);
    const loaderRef = useRef(loader);
    loaderRef.current = loader;

    useEffect(() => {
        const controller = new AbortController();
        setState((previous) => ({ data: previous.data, loading: true, error: null }));
        // Une réponse arrivée après un changement de page (ou un démontage) est ignorée :
        // certaines sources ne coupent pas leurs requêtes, dont le résultat sert de cache.
        loaderRef.current({ signal: controller.signal })
            .then((data) => {
                if (!controller.signal.aborted) setState({ data, loading: false, error: null });
            })
            .catch((error) => {
                if (!controller.signal.aborted && !isAbort(error)) {
                    setState((previous) => ({ data: previous.data, loading: false, error }));
                }
            });
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, attempt]);

    const retry = useCallback(() => setAttempt((value) => value + 1), []);
    return { ...state, retry };
};

export default useRdcData;
