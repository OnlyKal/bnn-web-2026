import React, { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MAP_ATTRIBUTION, MAP_TILE_URL } from '../../config';
import { DRC_CENTER, DRC_ZOOM, mediaUrl } from '../rdcUtils';

const DRC_BOUNDS = L.latLngBounds([-13.6, 12.0], [5.6, 31.5]);
const NO_FEATURES = [];

/** [lng, lat] du point affiché pour un tracé : point saisi, sinon centre de l'emprise. */
const shapeAnchor = (feature) => {
    if (feature.properties?.point) return feature.properties.point;
    try {
        const bounds = L.geoJSON(feature).getBounds();
        if (!bounds.isValid()) return null;
        const c = bounds.getCenter();
        return [c.lng, c.lat];
    } catch {
        return null;
    }
};

const FitToContent = ({ features, contour, center, zoom, fitKey }) => {
    const map = useMap();
    const lat = center?.[0];
    const lng = center?.[1];
    const featuresRef = useRef(features);
    featuresRef.current = features;
    // Sans `fitKey`, la vue se recale à chaque nouvelle liste d'objets.
    const trigger = fitKey ?? features;
    useEffect(() => {
        const features = featuresRef.current;
        const center = lat !== undefined && lng !== undefined ? [lat, lng] : null;
        const layers = [];
        if (contour) layers.push(L.geoJSON(contour));
        if (features?.length) layers.push(L.geoJSON({ type: 'FeatureCollection', features }));
        const bounds = layers.reduce((acc, layer) => {
            const b = layer.getBounds();
            return b.isValid() ? (acc ? acc.extend(b) : L.latLngBounds(b.getSouthWest(), b.getNorthEast())) : acc;
        }, null);
        if (bounds && bounds.isValid()) {
            map.fitBounds(bounds.pad(0.15), { maxZoom: zoom || 10, animate: false });
        } else {
            map.setView(center || DRC_CENTER, zoom || DRC_ZOOM, { animate: false });
        }
    }, [map, trigger, contour, lat, lng, zoom]);
    return null;
};

const FeaturePopup = ({ properties }) => {
    const to = properties.type_objet === 'province' ? `/rdc/provinces/${properties.slug}` : `/rdc/fiche/${properties.slug}`;
    const image = mediaUrl(properties.image);
    return (
        <div className="rdc-map-popup">
            {image && <img src={image} alt="" loading="lazy" />}
            {properties.categorie && <span className="rdc-map-popup-kicker" style={{ color: properties.couleur }}>{properties.categorie}</span>}
            <strong>{properties.titre}</strong>
            {properties.libelle_dates && <span className="rdc-map-popup-date">{properties.libelle_dates}</span>}
            {properties.resume && <p>{properties.resume}</p>}
            {properties.slug && (
                <Link to={to}>{properties.type_objet === 'province' ? 'Voir la province' : 'Lire la fiche'} →</Link>
            )}
        </div>
    );
};

/**
 * Carte interactive de la RDC.
 * - `features` : entités GeoJSON (points, tracés, zones) renvoyées par l'API ;
 * - `contour` : géométrie à mettre en évidence (ex. limites d'une province).
 */
const RdcMap = ({ features = NO_FEATURES, contour = null, center = null, zoom = null, height = 460, showLegend = true, className = '', fitKey }) => {
    const points = useMemo(() => features.filter((f) => f.geometry?.type === 'Point'), [features]);
    const shapes = useMemo(() => features.filter((f) => f.geometry && f.geometry.type !== 'Point'), [features]);
    const shapesKey = useMemo(() => shapes.map((f) => f.id).join('|'), [shapes]);
    const legend = useMemo(() => {
        const seen = new Map();
        features.forEach((f) => {
            const { categorie, couleur, type_objet: kind } = f.properties || {};
            const label = kind === 'province' ? 'Chefs-lieux de province' : categorie;
            if (label && !seen.has(label)) seen.set(label, couleur || '#1e42ac');
        });
        return [...seen.entries()];
    }, [features]);

    return (
        <div className={`rdc-map ${className}`} style={{ height }}>
            <MapContainer
                center={center || DRC_CENTER}
                zoom={zoom || DRC_ZOOM}
                minZoom={4}
                maxBounds={DRC_BOUNDS.pad(0.6)}
                scrollWheelZoom={false}
                className="rdc-map-canvas"
            >
                <TileLayer url={MAP_TILE_URL} attribution={MAP_ATTRIBUTION} />
                {contour && (
                    <GeoJSON
                        key={JSON.stringify(contour)}
                        data={contour}
                        style={{ color: '#053677', weight: 2, fillColor: '#1e42ac', fillOpacity: 0.08 }}
                    />
                )}
                {shapes.length > 0 && (
                    <GeoJSON
                        key={shapesKey}
                        data={{ type: 'FeatureCollection', features: shapes }}
                        style={(feature) => ({
                            color: feature.properties.couleur || '#1e42ac',
                            weight: feature.geometry.type.includes('Line') ? 4 : 2,
                            fillOpacity: 0.18,
                        })}
                        onEachFeature={(feature, layer) => {
                            layer.bindTooltip(feature.properties.titre, { sticky: true });
                        }}
                    />
                )}
                {shapes.map((feature) => {
                    // Point d'ancrage cliquable (popup React) pour chaque tracé ou zone.
                    const anchor = shapeAnchor(feature);
                    if (!anchor) return null;
                    return (
                        <CircleMarker
                            key={`anchor-${feature.id}`}
                            center={[anchor[1], anchor[0]]}
                            radius={5}
                            pathOptions={{ color: '#fff', weight: 2, fillColor: feature.properties.couleur || '#1e42ac', fillOpacity: 1 }}
                        >
                            <Popup><FeaturePopup properties={feature.properties} /></Popup>
                        </CircleMarker>
                    );
                })}
                {points.map((feature) => {
                    const [lng, lat] = feature.geometry.coordinates;
                    const isProvince = feature.properties.type_objet === 'province';
                    return (
                        <CircleMarker
                            key={feature.id}
                            center={[lat, lng]}
                            radius={isProvince ? 6 : 8}
                            pathOptions={{
                                color: '#ffffff',
                                weight: 2,
                                fillColor: feature.properties.couleur || '#1e42ac',
                                fillOpacity: isProvince ? 0.75 : 0.95,
                            }}
                        >
                            <Popup><FeaturePopup properties={feature.properties} /></Popup>
                        </CircleMarker>
                    );
                })}
                <FitToContent features={features} contour={contour} center={center} zoom={zoom} fitKey={fitKey} />
            </MapContainer>
            {showLegend && legend.length > 0 && (
                <ul className="rdc-map-legend" aria-label="Légende">
                    {legend.map(([label, color]) => (
                        <li key={label}><span style={{ background: color }} aria-hidden="true" />{label}</li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default RdcMap;
