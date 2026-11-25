import React, { useEffect, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import { salonsAPI } from '../api';
import { halApi } from '../services/externalSources/halApi';
import { openAlexApi, formatOpenAlexAuthors } from '../services/externalSources/openAlexApi';
import { SHARE_SOURCES } from './salonUtils';

const toText = (value) => (Array.isArray(value) ? value.join(', ') : value || '');

const searchers = {
    bnn: async (q) => {
        const response = await salonsAPI.searchBnnRessources(q);
        const rows = Array.isArray(response) ? response : response?.data || [];
        return rows.slice(0, 8).map((r) => ({
            source: 'bnn',
            identifiant: String(r.id),
            titre: r.titre || r.title || 'Sans titre',
            auteurs: toText(r.auteur || r.auteurs),
            url: null
        }));
    },
    hal: async (q, signal) => {
        const response = await halApi.getOuvrages({ q, page: 1, page_size: 8 }, signal);
        return (response?.results || []).map((r) => ({
            source: 'hal',
            identifiant: String(r.hal_id || r.id),
            titre: r.title || r.titre || 'Sans titre',
            auteurs: toText(r.authors || r.auteurs),
            url: r.url || r.uri || null
        }));
    },
    openalex: async (q, signal) => {
        const response = await openAlexApi.getWorks('all', { search: q, sort: 'relevance' }, 1, signal);
        return (response?.results || []).slice(0, 8).map((r) => ({
            source: 'openalex',
            identifiant: String(r.id),
            titre: r.title || 'Sans titre',
            auteurs: formatOpenAlexAuthors(r.authors),
            url: null
        }));
    }
};

/** Recherche une ressource de la BNN, de HAL ou d'OpenAlex à partager dans le salon. */
const SharePicker = ({ onPick, onClose }) => {
    const [source, setSource] = useState('bnn');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            setError('');
            return undefined;
        }
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                setLoading(true);
                setError('');
                setResults(await searchers[source](q, controller.signal));
            } catch (err) {
                if (err?.name !== 'AbortError' && err?.name !== 'CanceledError') setError(err.message || 'Recherche impossible');
            } finally {
                setLoading(false);
            }
        }, 400);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query, source]);

    return (
        <div className="salon-share-picker">
            <div className="salon-share-header">
                <strong>Partager une ressource</strong>
                <button type="button" onClick={onClose} aria-label="Fermer"><FaTimes /></button>
            </div>
            <div className="salon-filter-tabs">
                {Object.entries(SHARE_SOURCES).map(([key, value]) => (
                    <button key={key} type="button" className={source === key ? 'active' : ''} onClick={() => setSource(key)}>
                        {value.label}
                    </button>
                ))}
            </div>
            <input
                type="search"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Titre, auteur, mot-clé…"
            />
            <div className="salon-share-results">
                {loading && <span className="salons-muted">Recherche…</span>}
                {error && <span className="salons-muted">{error}</span>}
                {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
                    <span className="salons-muted">Aucun résultat</span>
                )}
                {results.map((item) => (
                    <button type="button" key={`${item.source}-${item.identifiant}`} onClick={() => onPick(item)}>
                        <strong>{item.titre}</strong>
                        {item.auteurs && <small>{item.auteurs}</small>}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default SharePicker;
