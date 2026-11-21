import React, { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuFolder, LuMapPin, LuSearch, LuX } from 'react-icons/lu';
import { encyclopedieAPI, isAbort } from '../../services/encyclopedieApi';
import { categoryIcon } from '../rdcUtils';

/** Recherche globale avec suggestions (fiches, provinces, catégories). */
const RdcSearchBox = ({ initialValue = '', placeholder = 'Rechercher dans l’encyclopédie de la RDC…', large = false, onSubmit = null }) => {
    const navigate = useNavigate();
    const listId = useId();
    const wrapperRef = useRef(null);
    const [query, setQuery] = useState(initialValue);
    const [open, setOpen] = useState(false);
    const [results, setResults] = useState(null);
    const [active, setActive] = useState(-1);

    useEffect(() => setQuery(initialValue), [initialValue]);

    useEffect(() => {
        const text = query.trim();
        if (text.length < 2) {
            setResults(null);
            return undefined;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => {
            encyclopedieAPI.recherche(text, { signal: controller.signal })
                .then((data) => {
                    if (controller.signal.aborted) return;
                    setResults(data);
                    setActive(-1);
                })
                .catch((error) => { if (!controller.signal.aborted && !isAbort(error)) setResults(null); });
        }, 250);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [query]);

    useEffect(() => {
        const close = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const suggestions = results ? [
        ...results.fiches.slice(0, 6).map((f) => ({
            key: `f-${f.id}`, label: f.titre, hint: f.categorie?.nom, to: `/rdc/fiche/${f.slug}`, icon: categoryIcon(f.categorie?.icone),
        })),
        ...results.provinces.map((p) => ({
            key: `p-${p.id}`, label: p.nom, hint: `Province · ${p.chef_lieu}`, to: `/rdc/provinces/${p.slug}`, icon: LuMapPin,
        })),
        ...results.categories.map((c) => ({
            key: `c-${c.id}`, label: c.nom, hint: 'Rubrique', to: `/rdc/categorie/${c.slug}`, icon: LuFolder,
        })),
    ] : [];

    const go = (to) => {
        setOpen(false);
        navigate(to);
    };

    const submit = (event) => {
        event.preventDefault();
        if (active >= 0 && suggestions[active]) {
            go(suggestions[active].to);
            return;
        }
        const text = query.trim();
        if (onSubmit) {
            setOpen(false);
            onSubmit(text);
            return;
        }
        go(text ? `/rdc/explorer?q=${encodeURIComponent(text)}` : '/rdc/explorer');
    };

    const onKeyDown = (event) => {
        if (!open || suggestions.length === 0) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((index) => (index + 1) % suggestions.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
        } else if (event.key === 'Escape') {
            setOpen(false);
        }
    };

    const showPanel = open && query.trim().length >= 2 && results;

    return (
        <div className={`rdc-search ${large ? 'rdc-search-large' : ''}`} ref={wrapperRef}>
            <form onSubmit={submit} role="search">
                <LuSearch className="rdc-search-icon" size={large ? 20 : 17} aria-hidden="true" />
                <input
                    type="search"
                    value={query}
                    placeholder={placeholder}
                    aria-label="Rechercher dans l’encyclopédie"
                    aria-autocomplete="list"
                    aria-controls={listId}
                    aria-expanded={Boolean(showPanel)}
                    onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={onKeyDown}
                />
                {query && (
                    <button type="button" className="rdc-search-clear" onClick={() => setQuery('')} aria-label="Effacer">
                        <LuX size={16} />
                    </button>
                )}
                <button type="submit" className="rdc-search-submit">Rechercher</button>
            </form>
            {showPanel && (
                <div className="rdc-search-panel" id={listId} role="listbox">
                    {suggestions.length === 0 ? (
                        <p className="rdc-search-empty">Aucune suggestion pour « {query.trim()} ».</p>
                    ) : suggestions.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.key}
                                type="button"
                                role="option"
                                aria-selected={index === active}
                                className={`rdc-search-option ${index === active ? 'active' : ''}`}
                                onMouseEnter={() => setActive(index)}
                                onClick={() => go(item.to)}
                            >
                                <Icon size={16} aria-hidden="true" />
                                <span className="rdc-search-option-label">{item.label}</span>
                                <span className="rdc-search-option-hint">{item.hint}</span>
                            </button>
                        );
                    })}
                    {results.total_fiches > 0 && (
                        <button type="button" className="rdc-search-all" onClick={submit}>
                            Voir les {results.total_fiches} fiche{results.total_fiches > 1 ? 's' : ''} correspondante{results.total_fiches > 1 ? 's' : ''}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default RdcSearchBox;
