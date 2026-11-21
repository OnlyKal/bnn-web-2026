import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    LuArrowRight, LuChevronLeft, LuChevronRight, LuClock, LuCompass, LuImages, LuLayers, LuLibrary, LuMapPin, LuSparkles, LuUsers,
} from 'react-icons/lu';
import RdcLayout from './components/RdcLayout';
import RdcSearchBox from './components/RdcSearchBox';
import FicheCard from './components/FicheCard';
import { SectionTitle } from './components/MpParts';
import RdcMap from './components/RdcMap';
import { RdcEmpty, RdcError, RdcLoading } from './components/RdcStates';
import useRdcData from './useRdcData';
import { encyclopedieAPI } from '../services/encyclopedieApi';
import { categoryIcon, formatNumber, formatYear, hiRes } from './rdcUtils';

const AUTOPLAY_MS = 7000;

/** Carrousel plein format des sujets à la une. */
const HeroCarousel = ({ slides }) => {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const count = slides.length;
    const go = useCallback((step) => setIndex((i) => (i + step + count) % count), [count]);

    useEffect(() => {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (paused || reduce || count < 2) return undefined;
        const timer = setInterval(() => go(1), AUTOPLAY_MS);
        return () => clearInterval(timer);
    }, [paused, count, go]);

    if (!count) return null;
    const slide = slides[index % count];

    return (
        <section
            className="mp-hero"
            aria-roledescription="carrousel"
            aria-label="À la une"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
        >
            {slides.map((s, i) => (
                <img
                    key={s.slug}
                    src={hiRes(s.image)}
                    alt=""
                    className={`mp-hero-bg ${i === index ? 'active' : ''}`}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    fetchPriority={i === 0 ? 'high' : 'low'}
                />
            ))}
            <div className="mp-hero-shade" aria-hidden="true" />
            <div className="mp-hero-content" aria-live="polite">
                <span className="mp-hero-kicker">
                    <LuSparkles size={14} aria-hidden="true" /> À la une{slide.categorie?.nom ? ` · ${slide.categorie.nom}` : ''}
                </span>
                <h2 className="mp-hero-title">{slide.titre}</h2>
                {slide.resume && <p className="mp-hero-text">{slide.resume}</p>}
                <div className="mp-hero-actions">
                    <Link to={`/rdc/fiche/${slide.slug}`} className="mp-btn mp-btn-light">
                        Découvrir <LuArrowRight size={16} aria-hidden="true" />
                    </Link>
                    {slide.libelle_dates && <span className="mp-hero-meta">{slide.libelle_dates}</span>}
                    {slide.provinces?.length > 0 && (
                        <span className="mp-hero-meta"><LuMapPin size={13} aria-hidden="true" /> {slide.provinces.map((p) => p.nom).join(', ')}</span>
                    )}
                </div>
            </div>
            {count > 1 && (
                <div className="mp-hero-controls">
                    <button type="button" onClick={() => go(-1)} aria-label="Sujet précédent"><LuChevronLeft size={20} /></button>
                    <div className="mp-hero-dots" role="tablist" aria-label="Choisir un sujet">
                        {slides.map((s, i) => (
                            <button
                                key={s.slug}
                                type="button"
                                role="tab"
                                aria-selected={i === index}
                                aria-label={s.titre}
                                className={i === index ? 'active' : ''}
                                onClick={() => setIndex(i)}
                            />
                        ))}
                    </div>
                    <button type="button" onClick={() => go(1)} aria-label="Sujet suivant"><LuChevronRight size={20} /></button>
                </div>
            )}
        </section>
    );
};

/** Tuile de grand thème : image de couverture, description et sous-thèmes. */
const ThemeTile = ({ categorie, large }) => {
    const Icon = categoryIcon(categorie.icone);
    const image = hiRes(categorie.image, large ? 1280 : 800);
    const max = large ? 7 : 4;
    return (
        <article className={`mp-theme-tile ${large ? 'large' : ''}`} style={{ '--mp-accent': categorie.couleur }}>
            <Link to={`/rdc/categorie/${categorie.slug}`} className="mp-theme-tile-link" aria-label={`Thème : ${categorie.nom}`} />
            {image ? <img src={image} alt="" loading="lazy" decoding="async" className="mp-theme-tile-img" /> : <div className="mp-theme-tile-pattern" aria-hidden="true" />}
            <div className="mp-theme-tile-shade" aria-hidden="true" />
            <div className="mp-theme-tile-body">
                <span className="mp-theme-tile-icon"><Icon size={large ? 24 : 20} aria-hidden="true" /></span>
                <h3>{categorie.nom}</h3>
                {categorie.description && <p>{categorie.description}</p>}
                <span className="mp-theme-tile-meta">
                    {categorie.enfants?.length || 0} sous-thèmes
                    {categorie.nb_fiches !== null && categorie.nb_fiches !== undefined && <> · {formatNumber(categorie.nb_fiches)} fiches</>}
                </span>
                {categorie.enfants?.length > 0 && (
                    <ul className="mp-theme-tile-subs">
                        {categorie.enfants.slice(0, max).map((sub) => (
                            <li key={sub.slug}><Link to={`/rdc/categorie/${sub.slug}`}>{sub.nom}</Link></li>
                        ))}
                        {categorie.enfants.length > max && <li className="more">+{categorie.enfants.length - max}</li>}
                    </ul>
                )}
            </div>
        </article>
    );
};

const RdcHomePage = () => {
    const { data, loading, error, retry } = useRdcData((options) => encyclopedieAPI.accueil(options), []);
    const provinces = useRdcData((options) => encyclopedieAPI.provinces(options), []);

    const slides = useMemo(() => (data?.vedette || []).filter((f) => f.image), [data]);
    const provinceFeatures = useMemo(() => (provinces.data?.results || [])
        .filter((p) => p.latitude !== null && p.longitude !== null)
        .map((p) => ({
            type: 'Feature',
            id: `province-${p.slug}`,
            geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
            properties: { type_objet: 'province', slug: p.slug, titre: p.nom, couleur: '#053677', resume: p.chef_lieu ? `Chef-lieu : ${p.chef_lieu}` : '' },
        })), [provinces.data]);

    const stats = data?.statistiques || {};
    const subCount = (data?.categories || []).reduce((n, c) => n + (c.enfants?.length || 0), 0);
    const totalPopulation = (provinces.data?.results || []).reduce((n, p) => n + (p.population || 0), 0);
    const reperes = [
        { icon: LuCompass, value: stats.provinces, label: 'Provinces', to: '/rdc/provinces' },
        { icon: LuUsers, value: totalPopulation || null, label: 'Habitants (somme des provinces)', to: '/rdc/provinces' },
        { icon: LuLayers, value: stats.categories, label: 'Grands thèmes', to: '/rdc/explorer' },
        { icon: LuLayers, value: subCount || null, label: 'Sous-thèmes', to: '/rdc/explorer' },
        { icon: LuClock, value: data?.periodes?.length, label: 'Périodes historiques', to: '/rdc/chronologie' },
        { icon: LuLibrary, value: stats.fiches, label: 'Fiches documentaires', to: '/rdc/explorer' },
        { icon: LuImages, value: stats.medias, label: 'Médias', to: '/rdc/explorer' },
    ].filter((r) => r.value !== null && r.value !== undefined);

    return (
        <RdcLayout>
            {loading && !data && <RdcLoading variant="detail" />}
            {error && !data && <RdcError error={error} onRetry={retry} />}

            {data && (
                <>
                    {slides.length > 0 && <HeroCarousel slides={slides} />}

                    <section className="mp-intro" aria-labelledby="mp-intro-title">
                        <div className="mp-intro-text">
                            <span className="mp-eyebrow"><span className="rdc-flag" aria-hidden="true" /> Mon pays</span>
                            <h1 id="mp-intro-title">Découvrir la République démocratique du Congo</h1>
                            <p>
                                Histoire, géographie, infrastructures, énergie, biodiversité, ressources naturelles et patrimoine :
                                un espace de référence pour explorer et comprendre le pays, province par province, époque par époque.
                            </p>
                        </div>
                        <div className="mp-intro-search"><RdcSearchBox large /></div>
                    </section>

                    {reperes.length > 0 && (
                        <section className="mp-reperes" aria-label="Repères">
                            {reperes.map((r) => {
                                const Icon = r.icon;
                                return (
                                    <Link key={r.label} to={r.to} className="mp-repere">
                                        <span className="mp-repere-icon"><Icon size={18} aria-hidden="true" /></span>
                                        <strong>{formatNumber(r.value)}</strong>
                                        <span>{r.label}</span>
                                    </Link>
                                );
                            })}
                        </section>
                    )}

                    <section className="mp-section" aria-labelledby="mp-themes">
                        <SectionTitle id="mp-themes" eyebrow="Explorer par thème" title="Sept portes d’entrée sur le pays" action="Tout explorer" to="/rdc/explorer" />
                        <div className="mp-theme-mosaic">
                            {data.categories.map((categorie, i) => <ThemeTile key={categorie.slug} categorie={categorie} large={i === 0} />)}
                        </div>
                    </section>

                    <section className="mp-duo">
                        <article className="mp-feature" aria-labelledby="mp-territoire">
                            <div className="mp-feature-head">
                                <span className="mp-eyebrow"><LuCompass size={14} aria-hidden="true" /> Le territoire</span>
                                <h2 id="mp-territoire">26 provinces, un même pays</h2>
                                <p>Chefs-lieux, superficies, populations, villes et territoires : parcourez la carte ou la liste des provinces.</p>
                            </div>
                            <div className="mp-feature-map">
                                <RdcMap features={provinceFeatures} height={280} showLegend={false} />
                            </div>
                            <div className="mp-feature-actions">
                                <Link to="/rdc/provinces" className="mp-btn">Les provinces <LuArrowRight size={15} aria-hidden="true" /></Link>
                                <Link to="/rdc/carte" className="mp-btn mp-btn-soft">Carte interactive</Link>
                            </div>
                        </article>

                        <article className="mp-feature" aria-labelledby="mp-temps">
                            <div className="mp-feature-head">
                                <span className="mp-eyebrow"><LuClock size={14} aria-hidden="true" /> Voyage dans le temps</span>
                                <h2 id="mp-temps">Des royaumes à la Troisième République</h2>
                                <p>Les grandes périodes de l’histoire congolaise, avec leurs événements et leurs figures.</p>
                            </div>
                            <ol className="mp-mini-timeline">
                                {data.periodes.map((periode) => (
                                    <li key={periode.slug} style={{ '--mp-accent': periode.couleur }}>
                                        <Link to={`/rdc/chronologie?periode=${periode.slug}`}>
                                            <span className="mp-mini-years">
                                                {periode.annee_debut !== null ? formatYear(periode.annee_debut) : '…'} – {periode.annee_fin !== null ? formatYear(periode.annee_fin) : 'auj.'}
                                            </span>
                                            <strong>{periode.nom}</strong>
                                        </Link>
                                    </li>
                                ))}
                            </ol>
                            <div className="mp-feature-actions">
                                <Link to="/rdc/chronologie" className="mp-btn">Ouvrir la chronologie <LuArrowRight size={15} aria-hidden="true" /></Link>
                            </div>
                        </article>
                    </section>

                    {data.vedette.length > 0 && (
                        <section className="mp-section" aria-labelledby="mp-featured">
                            <SectionTitle id="mp-featured" eyebrow="Sélection" title="À la une" action="Voir la sélection" to="/rdc/explorer?vedette=1" />
                            <div className="rdc-card-grid">
                                {data.vedette.map((fiche) => <FicheCard key={fiche.id} fiche={fiche} />)}
                            </div>
                        </section>
                    )}

                    {data.source !== 'wikimedia' && (
                        <section className="mp-section" aria-labelledby="mp-recent">
                            <SectionTitle id="mp-recent" eyebrow="Nouveautés" title="Dernières publications" action="Voir tout" to="/rdc/explorer?ordering=recent" />
                            {data.recentes.length > 0 ? (
                                <div className="rdc-card-grid">
                                    {data.recentes.map((fiche) => <FicheCard key={fiche.id} fiche={fiche} />)}
                                </div>
                            ) : (
                                <RdcEmpty
                                    title="Les premières fiches arrivent bientôt"
                                    message="Les rubriques et les 26 provinces sont en place ; les fiches documentaires sont ajoutées progressivement par l’équipe éditoriale."
                                />
                            )}
                        </section>
                    )}
                </>
            )}
        </RdcLayout>
    );
};

export default RdcHomePage;
