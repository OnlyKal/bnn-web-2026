import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
    LuBookOpen, LuChevronDown, LuChevronRight, LuClock, LuCompass, LuLayoutGrid, LuMap, LuMenu, LuX,
} from 'react-icons/lu';
import AppNavigation from '../../components/AppNavigation';
import { resolveSource } from '../../services/encyclopedieApi';
import { LICENCE_NOTICE } from '../online/wikiSource';
import useRdcTree, { findRoot } from '../useRdcTree';
import { categoryIcon } from '../rdcUtils';
import { setPageTitle } from '../../utils/pageTitle';
import RdcSearchBox from './RdcSearchBox';
import '../../styles/Encyclopedie.css';
import '../../styles/MonPays.css';

const DISCOVER = [
    { to: '/rdc', label: 'Accueil', icon: LuBookOpen, end: true },
    { to: '/rdc/explorer', label: 'Tout explorer', icon: LuLayoutGrid },
];
const TERRITORY = [
    { to: '/rdc/provinces', label: 'Les 26 provinces', icon: LuCompass },
    { to: '/rdc/carte', label: 'Carte interactive', icon: LuMap },
];
const HISTORY = [{ to: '/rdc/chronologie', label: 'Chronologie', icon: LuClock }];

const linkClass = ({ isActive }) => `mp-nav-link ${isActive ? 'active' : ''}`;

const NavGroup = ({ title, items }) => (
    <div className="mp-nav-group">
        <p className="mp-nav-title">{title}</p>
        {items.map((item) => {
            const Icon = item.icon;
            return (
                <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                    <Icon size={17} aria-hidden="true" />
                    <span>{item.label}</span>
                </NavLink>
            );
        })}
    </div>
);

/** Navigation « Mon pays » : découvrir, thèmes (dépliables), territoire, histoire. */
const SideNav = ({ active }) => {
    const tree = useRdcTree();
    const activeRoot = findRoot(tree, active);
    const [open, setOpen] = useState(null);
    const expanded = open ?? activeRoot?.slug ?? null;

    return (
        <nav className="mp-nav" aria-label="Rubriques de Mon pays">
            <NavGroup title="Découvrir" items={DISCOVER} />
            <div className="mp-nav-group">
                <p className="mp-nav-title">Thèmes</p>
                {tree.map((root) => {
                    const Icon = categoryIcon(root.icone);
                    const isOpen = expanded === root.slug;
                    const isActive = activeRoot?.slug === root.slug;
                    return (
                        <div key={root.slug} className={`mp-theme ${isActive ? 'active' : ''}`} style={{ '--mp-accent': root.couleur }}>
                            <div className="mp-theme-row">
                                <Link to={`/rdc/categorie/${root.slug}`} className={`mp-nav-link mp-theme-link ${active === root.slug ? 'active' : ''}`}>
                                    <span className="mp-theme-icon"><Icon size={15} aria-hidden="true" /></span>
                                    <span>{root.nom}</span>
                                </Link>
                                {root.enfants?.length > 0 && (
                                    <button
                                        type="button"
                                        className="mp-theme-toggle"
                                        onClick={() => setOpen(isOpen ? '' : root.slug)}
                                        aria-expanded={isOpen}
                                        aria-label={`${isOpen ? 'Replier' : 'Déplier'} ${root.nom}`}
                                    >
                                        <LuChevronDown size={15} className={isOpen ? 'open' : ''} />
                                    </button>
                                )}
                            </div>
                            {isOpen && (
                                <ul className="mp-sub-list">
                                    {root.enfants.map((sub) => (
                                        <li key={sub.slug}>
                                            <Link to={`/rdc/categorie/${sub.slug}`} className={`mp-sub-link ${active === sub.slug ? 'active' : ''}`}>
                                                {sub.nom}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </div>
            <NavGroup title="Territoire" items={TERRITORY} />
            <NavGroup title="Histoire" items={HISTORY} />
        </nav>
    );
};

/**
 * Gabarit de la rubrique « Mon pays » : barre BNN, navigation latérale
 * permanente (tiroir sur tablette et téléphone), fil d'Ariane, contenu.
 */
const RdcLayout = ({ title, breadcrumb = [], children, wide = false, active = null }) => {
    const location = useLocation();
    const [source, setSource] = useState(null);
    const [drawer, setDrawer] = useState(false);

    useEffect(() => {
        let alive = true;
        resolveSource().then((mode) => { if (alive) setSource(mode); });
        return () => { alive = false; };
    }, []);

    useEffect(() => {
        setPageTitle(title || 'Mon pays');
    }, [title]);

    // Le tiroir se ferme à chaque navigation.
    useEffect(() => { setDrawer(false); }, [location.pathname, location.search]);

    useEffect(() => {
        if (!drawer) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setDrawer(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [drawer]);

    const current = breadcrumb.length ? breadcrumb[breadcrumb.length - 1].label : 'Accueil';

    return (
        <div className="rdc-page mp-page">
            <AppNavigation />

            <div className="mp-context">
                <button type="button" className="mp-context-menu" onClick={() => setDrawer(true)} aria-expanded={drawer}>
                    <LuMenu size={18} aria-hidden="true" />
                    <span>Rubriques</span>
                </button>
                <span className="mp-context-title">
                    <span className="rdc-flag" aria-hidden="true" /> Mon pays
                    <LuChevronRight size={14} aria-hidden="true" />
                    <strong>{current}</strong>
                </span>
            </div>

            <div className={`mp-shell ${wide ? 'mp-shell-wide' : ''}`}>
                <aside className={`mp-side ${drawer ? 'open' : ''}`} aria-label="Navigation Mon pays">
                    <div className="mp-side-inner">
                        <div className="mp-side-head">
                            <Link to="/rdc" className="mp-brand">
                                <span className="rdc-flag mp-brand-flag" aria-hidden="true" />
                                <span>
                                    <strong>Mon pays</strong>
                                    <small>République démocratique du Congo</small>
                                </span>
                            </Link>
                            <button type="button" className="mp-side-close" onClick={() => setDrawer(false)} aria-label="Fermer le menu">
                                <LuX size={20} />
                            </button>
                        </div>
                        <div className="mp-side-search">
                            <RdcSearchBox placeholder="Rechercher…" />
                        </div>
                        <SideNav active={active} />
                        {source === 'online' && (
                            <p className="mp-side-licence">
                                {LICENCE_NOTICE}{' '}
                                <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>
                            </p>
                        )}
                    </div>
                </aside>
                {drawer && <button type="button" className="mp-backdrop" aria-label="Fermer le menu" onClick={() => setDrawer(false)} />}

                <main className="mp-main">
                    {breadcrumb.length > 0 && (
                        <ol className="rdc-breadcrumb mp-breadcrumb" aria-label="Fil d’Ariane">
                            {breadcrumb.map((item, index) => (
                                <li key={`${item.label}-${index}`}>
                                    {index > 0 && <LuChevronRight size={13} aria-hidden="true" />}
                                    {item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
                                </li>
                            ))}
                        </ol>
                    )}
                    {children}
                    {source === 'online' && (
                        <footer className="mp-footer">
                            {LICENCE_NOTICE}{' '}
                            <a href="https://www.wikidata.org/" target="_blank" rel="noopener noreferrer">Wikidata</a>
                            {' · '}
                            <a href="https://fr.wikipedia.org/" target="_blank" rel="noopener noreferrer">Wikipédia</a>
                        </footer>
                    )}
                </main>
            </div>
        </div>
    );
};

export default RdcLayout;
