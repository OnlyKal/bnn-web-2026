import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    LuBookOpen, LuCalendar, LuClock, LuExternalLink, LuEye, LuInfo, LuMapPin, LuShare2, LuTag,
} from 'react-icons/lu';
import RdcLayout from './components/RdcLayout';
import FicheCard from './components/FicheCard';
import MediaGallery from './components/MediaGallery';
import RdcMap from './components/RdcMap';
import { StatTiles } from './components/MpParts';
import { RdcError, RdcLoading } from './components/RdcStates';
import useRdcData from './useRdcData';
import { encyclopedieAPI } from '../services/encyclopedieApi';
import { anchorId, categoryIcon, formatDate, formatNumber, hiRes, sanitizeHtml } from './rdcUtils';

const ficheFeatures = (fiche) => {
    if (!fiche) return [];
    const properties = {
        type_objet: 'fiche', slug: fiche.slug, titre: fiche.titre, categorie: fiche.categorie?.nom,
        couleur: fiche.categorie?.couleur, libelle_dates: fiche.libelle_dates,
    };
    const features = [];
    if (fiche.geometrie) {
        const geometry = fiche.geometrie.type === 'Feature' ? fiche.geometrie.geometry : fiche.geometrie;
        if (geometry) features.push({ type: 'Feature', id: `geo-${fiche.id}`, geometry, properties });
    }
    if (fiche.latitude !== null && fiche.longitude !== null && fiche.latitude !== undefined) {
        features.push({ type: 'Feature', id: `pt-${fiche.id}`, geometry: { type: 'Point', coordinates: [fiche.longitude, fiche.latitude] }, properties });
    }
    return features;
};

/** HTML nettoyé, avec des ancres sur les intertitres, et la liste de ces intertitres (sommaire). */
const withAnchors = (rawHtml) => {
    const html = sanitizeHtml(rawHtml);
    if (!html || typeof window === 'undefined') return { html, headings: [] };
    const doc = new window.DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    const headings = [];
    doc.querySelectorAll('h2').forEach((h) => {
        const text = h.textContent.trim();
        if (!text) return;
        let id = anchorId(text);
        while (headings.some((x) => x.id === id)) id = `${id}-2`;
        h.id = id;
        headings.push({ id, label: text });
    });
    return { html: doc.body.firstChild.innerHTML, headings };
};

const SourceItem = ({ source }) => {
    const parts = [source.auteurs, source.titre && `« ${source.titre} »`, source.editeur, source.annee, source.note].filter(Boolean);
    return (
        <li>
            <span className="rdc-chip">{source.type_label}</span>
            <span>{parts.join(', ')}.</span>
            {source.url && (
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="rdc-link">
                    Consulter <LuExternalLink size={13} aria-hidden="true" />
                </a>
            )}
        </li>
    );
};

/** Barre de progression de lecture, en haut de la fenêtre. */
const ReadingProgress = () => {
    const [progress, setProgress] = useState(0);
    useEffect(() => {
        const update = () => {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
        };
        update();
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
    }, []);
    return <div className="mp-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />;
};

/** Sommaire « Sur cette page » ; la section visible est mise en évidence. */
const PageToc = ({ items }) => {
    const [current, setCurrent] = useState(items[0]?.id);
    useEffect(() => {
        if (!('IntersectionObserver' in window)) return undefined;
        const observer = new IntersectionObserver((entries) => {
            const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
            if (visible[0]) setCurrent(visible[0].target.id);
        }, { rootMargin: '-120px 0px -65% 0px' });
        items.forEach((item) => { const el = document.getElementById(item.id); if (el) observer.observe(el); });
        return () => observer.disconnect();
    }, [items]);
    if (items.length < 2) return null;
    return (
        <nav className="mp-toc" aria-label="Sur cette page">
            <span className="mp-toc-title">Sur cette page</span>
            <ul>
                {items.map((item) => (
                    <li key={item.id}>
                        <a href={`#${item.id}`} className={current === item.id ? 'active' : ''} onClick={(e) => {
                            e.preventDefault();
                            document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            setCurrent(item.id);
                        }}>
                            {item.label}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

const RdcFichePage = () => {
    const { slug } = useParams();
    const { data: fiche, loading, error, retry } = useRdcData((options) => encyclopedieAPI.fiche(slug, options), [slug]);
    const features = useMemo(() => ficheFeatures(fiche), [fiche]);
    const { html, headings } = useMemo(() => withAnchors(fiche?.contenu), [fiche]);
    const [copied, setCopied] = useState(false);

    const activeCategory = fiche?.fil_ariane?.[fiche.fil_ariane.length - 1]?.slug || fiche?.categorie?.slug || null;
    const breadcrumb = [
        { label: 'Mon pays', to: '/rdc' },
        ...(fiche?.fil_ariane || []).map((c) => ({ label: c.nom, to: `/rdc/categorie/${c.slug}` })),
        { label: fiche?.titre || '…' },
    ];

    if (error && !fiche) {
        return (
            <RdcLayout title="Fiche introuvable" breadcrumb={[{ label: 'Mon pays', to: '/rdc' }, { label: 'Fiche' }]}>
                <RdcError error={error} onRetry={error.status === 404 ? null : retry} />
            </RdcLayout>
        );
    }
    if (loading && !fiche) {
        return <RdcLayout breadcrumb={[{ label: 'Mon pays', to: '/rdc' }, { label: '…' }]}><RdcLoading variant="detail" /></RdcLayout>;
    }
    if (!fiche) return null;

    const Icon = categoryIcon(fiche.categorie?.icone);
    const cover = hiRes(fiche.image_principale, 1600);
    const share = async () => {
        const data = { title: fiche.titre, text: fiche.resume, url: window.location.href };
        try {
            if (navigator.share) await navigator.share(data);
            else {
                await navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch {
            /* partage annulé */
        }
    };

    const toc = [
        { id: 'presentation', label: 'Présentation' },
        ...headings,
        fiche.medias.length > 0 && { id: 'galerie', label: 'Galerie et documents' },
        fiche.sources.length > 0 && { id: 'sources', label: 'Sources et références' },
        fiche.fiches_liees.length > 0 && { id: 'voir-aussi', label: 'Pour aller plus loin' },
    ].filter(Boolean);

    const reperes = [
        { icon: LuTag, label: 'Type', value: fiche.nature_label },
        fiche.date_precise ? { icon: LuCalendar, label: 'Date', value: formatDate(fiche.date_precise) }
            : { icon: LuCalendar, label: 'Date(s)', value: fiche.libelle_dates || null },
        { icon: LuMapPin, label: fiche.provinces.length > 1 ? 'Provinces' : 'Province', value: fiche.provinces.map((p) => p.nom).join(', ') || null },
        ...fiche.donnees.slice(0, 3).map((d) => ({
            icon: LuInfo, label: d.libelle, value: `${d.valeur}${d.unite ? ` ${d.unite}` : ''}`, hint: d.annee ? `(${d.annee})` : null,
        })),
    ];

    return (
        <RdcLayout title={fiche.titre} breadcrumb={breadcrumb} active={activeCategory}>
            <ReadingProgress />
            <article className="mp-article" style={{ '--mp-accent': fiche.categorie?.couleur || '#1e42ac', '--rdc-accent': fiche.categorie?.couleur || '#1e42ac' }}>
                <header className={`mp-article-hero ${cover ? 'has-image' : ''}`}>
                    {cover && <img src={cover} alt="" className="mp-article-hero-img" fetchPriority="high" />}
                    <div className="mp-article-hero-shade" aria-hidden="true" />
                    <div className="mp-article-hero-body">
                        {fiche.categorie?.slug ? (
                            <Link to={`/rdc/categorie/${fiche.categorie.slug}`} className="mp-article-kicker">
                                <Icon size={15} aria-hidden="true" /> {fiche.categorie.nom}
                            </Link>
                        ) : (
                            <span className="mp-article-kicker"><Icon size={15} aria-hidden="true" /> {fiche.categorie?.nom}</span>
                        )}
                        <h1>{fiche.titre}</h1>
                        <div className="mp-article-meta">
                            <span className="mp-pill">{fiche.nature_label}</span>
                            {fiche.libelle_dates && <span><LuCalendar size={14} aria-hidden="true" /> {fiche.libelle_dates}</span>}
                            {fiche.provinces.length > 0 && (
                                <span>
                                    <LuMapPin size={14} aria-hidden="true" />
                                    {fiche.provinces.map((p, i) => (
                                        <React.Fragment key={p.slug}>
                                            {i > 0 && ', '}
                                            <Link to={`/rdc/provinces/${p.slug}`}>{p.nom}</Link>
                                        </React.Fragment>
                                    ))}
                                </span>
                            )}
                            <button type="button" className="mp-icon-btn" onClick={share} aria-label="Partager cette fiche" title="Partager">
                                <LuShare2 size={16} />
                            </button>
                            {copied && <span className="mp-copied" role="status">Lien copié</span>}
                        </div>
                    </div>
                    {cover && fiche.credit_image && <span className="mp-article-credit">© {fiche.credit_image}</span>}
                </header>

                <StatTiles items={reperes} />

                <div className="mp-article-grid">
                    <aside className="mp-article-toc">
                        <PageToc items={toc} />
                    </aside>

                    <div className="mp-article-main">
                        <section id="presentation" className="mp-block mp-anchor">
                            <p className="mp-lead">{fiche.resume}</p>
                            {html && <div className="rdc-prose mp-prose" dangerouslySetInnerHTML={{ __html: html }} />}
                        </section>

                        {fiche.medias.length > 0 && (
                            <section id="galerie" className="mp-block mp-anchor" aria-labelledby="galerie-title">
                                <h2 id="galerie-title" className="mp-block-title">Galerie et documents</h2>
                                <MediaGallery medias={fiche.medias} />
                            </section>
                        )}

                        {fiche.sources.length > 0 && (
                            <section id="sources" className="mp-block mp-anchor" aria-labelledby="sources-title">
                                <h2 id="sources-title" className="mp-block-title">Sources et références</h2>
                                <ol className="rdc-sources">
                                    {fiche.sources.map((source) => <SourceItem key={source.id} source={source} />)}
                                </ol>
                            </section>
                        )}
                    </div>

                    <aside className="mp-article-aside" aria-label="Fiche technique">
                        <section className="mp-panel">
                            <h2>Fiche technique</h2>
                            <dl className="rdc-facts">
                                {fiche.fil_ariane.length > 0 && <div><dt>Thème</dt><dd>{fiche.fil_ariane.map((c) => c.nom).join(' › ')}</dd></div>}
                                <div><dt>Type</dt><dd>{fiche.nature_label}</dd></div>
                                {fiche.periode && (
                                    <div>
                                        <dt>Période</dt>
                                        <dd><Link to={`/rdc/chronologie?periode=${fiche.periode.slug}`}>{fiche.periode.nom}</Link> ({fiche.periode.libelle_dates})</dd>
                                    </div>
                                )}
                                {fiche.date_precise && <div><dt>Date</dt><dd>{formatDate(fiche.date_precise)}</dd></div>}
                                {!fiche.date_precise && fiche.libelle_dates && <div><dt>Date(s)</dt><dd>{fiche.libelle_dates}</dd></div>}
                                {fiche.lieu && <div><dt>Localisation</dt><dd>{fiche.lieu}</dd></div>}
                                {fiche.localites.length > 0 && (
                                    <div><dt>Villes / territoires</dt><dd>{fiche.localites.map((l) => `${l.nom} (${l.type_label})`).join(', ')}</dd></div>
                                )}
                                {fiche.donnees.map((donnee) => (
                                    <div key={donnee.id}>
                                        <dt>{donnee.libelle}</dt>
                                        <dd>
                                            {donnee.valeur}{donnee.unite ? ` ${donnee.unite}` : ''}
                                            {donnee.annee && <small> ({donnee.annee})</small>}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </section>

                        {features.length > 0 && (
                            <section className="mp-panel mp-panel-map">
                                <h2>Localisation</h2>
                                <RdcMap features={features} height={240} zoom={9} showLegend={false} />
                                {fiche.latitude !== null && fiche.latitude !== undefined && (
                                    <p className="rdc-coords">{fiche.latitude.toFixed(4)}°, {fiche.longitude.toFixed(4)}°</p>
                                )}
                            </section>
                        )}

                        {fiche.mots_cles.length > 0 && (
                            <section className="mp-panel">
                                <h2>Mots-clés</h2>
                                <div className="rdc-tags">
                                    {fiche.mots_cles.map((mot) => (
                                        <Link key={mot} to={`/rdc/explorer?q=${encodeURIComponent(mot)}`} className="rdc-chip">{mot}</Link>
                                    ))}
                                </div>
                            </section>
                        )}

                        {(fiche.date_mise_a_jour || (fiche.vues !== null && fiche.vues !== undefined)) && (
                            <p className="rdc-updated">
                                {fiche.date_mise_a_jour && <span><LuClock size={13} aria-hidden="true" /> Mise à jour le {formatDate(fiche.date_mise_a_jour)}</span>}
                                {fiche.vues !== null && fiche.vues !== undefined && (
                                    <span><LuEye size={13} aria-hidden="true" /> {formatNumber(fiche.vues)} consultation{fiche.vues > 1 ? 's' : ''}</span>
                                )}
                            </p>
                        )}
                    </aside>
                </div>

                {fiche.fiches_liees.length > 0 && (
                    <section id="voir-aussi" className="mp-section mp-anchor" aria-labelledby="voir-aussi-title">
                        <div className="mp-section-head">
                            <div>
                                <span className="mp-eyebrow"><LuBookOpen size={14} aria-hidden="true" /> Dans le même thème</span>
                                <h2 id="voir-aussi-title">Pour aller plus loin</h2>
                            </div>
                        </div>
                        <div className="rdc-card-grid">
                            {fiche.fiches_liees.map((liee) => <FicheCard key={liee.id} fiche={liee} />)}
                        </div>
                    </section>
                )}
            </article>
        </RdcLayout>
    );
};

export default RdcFichePage;
