import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LuMap } from 'react-icons/lu';
import RdcLayout from './components/RdcLayout';
import RdcMap from './components/RdcMap';
import { PageBanner } from './components/MpParts';
import { RdcError } from './components/RdcStates';
import useRdcData from './useRdcData';
import { encyclopedieAPI } from '../services/encyclopedieApi';
import { categoryIcon, formatNumber } from './rdcUtils';

/** Carte générale : couches par grande rubrique, filtre par province, chefs-lieux. */
const RdcCartePage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const province = searchParams.get('province') || '';
    const [hidden, setHidden] = useState(() => new Set());
    const [showCapitals, setShowCapitals] = useState(true);

    const facets = useRdcData((options) => encyclopedieAPI.filtres(options), []);
    const map = useRdcData((options) => encyclopedieAPI.carte({ provinces: 1, province }, options), [province]);

    const layers = useMemo(() => {
        const counts = new Map();
        (map.data?.features || []).forEach((f) => {
            const slug = f.properties.rubrique_slug;
            if (slug) counts.set(slug, (counts.get(slug) || 0) + 1);
        });
        return (facets.data?.categories || []).map((c) => ({ ...c, count: counts.get(c.slug) || 0 }));
    }, [facets.data, map.data]);

    const features = useMemo(() => (map.data?.features || []).filter((f) => (
        f.properties.type_objet === 'province' ? showCapitals : !hidden.has(f.properties.rubrique_slug)
    )), [map.data, hidden, showCapitals]);

    const toggle = (slug) => setHidden((previous) => {
        const next = new Set(previous);
        if (next.has(slug)) next.delete(slug); else next.add(slug);
        return next;
    });

    const fichesCount = (map.data?.features || []).filter((f) => f.properties.type_objet === 'fiche').length;

    return (
        <RdcLayout title="Carte interactive" wide breadcrumb={[{ label: 'Mon pays', to: '/rdc' }, { label: 'Carte' }]}>
            <PageBanner
                color="#0369a1"
                icon={LuMap}
                eyebrow="Le territoire"
                title="Carte interactive de la RDC"
                description="Infrastructures, barrages, parcs, gisements, sites historiques et touristiques : activez les couches et cliquez sur un point pour ouvrir sa fiche."
                compact
            />

            <div className="rdc-map-layout">
                <aside className="rdc-panel rdc-map-layers" aria-label="Couches de la carte">
                    <h2>Couches</h2>
                    <label className="rdc-layer">
                        <input type="checkbox" checked={showCapitals} onChange={(e) => setShowCapitals(e.target.checked)} />
                        <span className="rdc-layer-swatch" style={{ background: '#053677' }} aria-hidden="true" />
                        <span>Chefs-lieux de province</span>
                    </label>
                    {layers.map((layer) => {
                        const Icon = categoryIcon(layer.icone);
                        return (
                            <label key={layer.slug} className={`rdc-layer ${layer.count === 0 ? 'is-empty' : ''}`}>
                                <input type="checkbox" checked={!hidden.has(layer.slug)} onChange={() => toggle(layer.slug)} />
                                <span className="rdc-layer-swatch" style={{ background: layer.couleur }} aria-hidden="true" />
                                <Icon size={14} aria-hidden="true" />
                                <span>{layer.nom}</span>
                                <small>{layer.count}</small>
                            </label>
                        );
                    })}
                    <label className="rdc-layer-select">
                        <span>Province</span>
                        <select
                            value={province}
                            onChange={(e) => setSearchParams(e.target.value ? { province: e.target.value } : {})}
                        >
                            <option value="">Toute la RDC</option>
                            {(facets.data?.provinces || []).map((p) => <option key={p.slug} value={p.slug}>{p.nom}</option>)}
                        </select>
                    </label>
                    {map.data && (
                        <p className="rdc-note">{formatNumber(fichesCount)} objet{fichesCount > 1 ? 's' : ''} localisé{fichesCount > 1 ? 's' : ''}{map.data.tronque ? ' (affichage limité)' : ''}.</p>
                    )}
                </aside>
                <div className="rdc-map-stage">
                    {map.error && <RdcError error={map.error} onRetry={map.retry} />}
                    <RdcMap features={features} fitKey={map.data} height="min(72vh, 720px)" />
                    {map.loading && <div className="rdc-map-loading" role="status">Chargement de la carte…</div>}
                </div>
            </div>
        </RdcLayout>
    );
};

export default RdcCartePage;
