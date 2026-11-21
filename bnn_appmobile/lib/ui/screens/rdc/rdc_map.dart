import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/config.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/json_utils.dart';
import '../../../data/models/encyclopedie.dart';
import '../../widgets/common.dart';
import 'rdc_widgets.dart';

const rdcCenter = LatLng(-2.88, 23.65);
final _drcBounds = LatLngBounds(const LatLng(-14.5, 10.5), const LatLng(6.5, 33.0));

LatLng? _latLng(dynamic pair) {
  if (pair is! List || pair.length < 2) return null;
  final lng = (pair[0] as num?)?.toDouble();
  final lat = (pair[1] as num?)?.toDouble();
  return lng == null || lat == null ? null : LatLng(lat, lng);
}

List<LatLng> _line(dynamic coords) => coords is List ? coords.map(_latLng).whereType<LatLng>().toList() : <LatLng>[];

/// Lignes (LineString/MultiLineString) d'une géométrie GeoJSON.
List<List<LatLng>> geoLines(Json? geometry) => switch (geometry?['type']) {
      'LineString' => [_line(geometry!['coordinates'])],
      'MultiLineString' => [for (final l in geometry!['coordinates'] as List) _line(l)],
      _ => const [],
    };

/// Anneaux extérieurs des polygones (Polygon/MultiPolygon) d'une géométrie GeoJSON.
List<List<LatLng>> geoPolygons(Json? geometry) => switch (geometry?['type']) {
      'Polygon' => [_line((geometry!['coordinates'] as List).first)],
      'MultiPolygon' => [for (final p in geometry!['coordinates'] as List) _line((p as List).first)],
      _ => const [],
    };

List<LatLng> _allPoints(Json? geometry) => [
      if (geometry?['type'] == 'Point') ?_latLng(geometry!['coordinates']),
      if (geometry?['type'] == 'MultiPoint') ..._line(geometry!['coordinates']),
      for (final l in geoLines(geometry)) ...l,
      for (final p in geoPolygons(geometry)) ...p,
    ];

LatLng? _anchor(RdcMapFeature f) {
  if (f.anchor != null) return LatLng(f.anchor![1], f.anchor![0]);
  final points = _allPoints(f.geometry);
  if (points.isEmpty) return null;
  if (f.geometry['type'] == 'Point') return points.first;
  return LatLngBounds.fromPoints(points).center;
}

/// Carte interactive (OpenStreetMap) : points, tracés et zones de l'encyclopédie.
class RdcMapView extends StatelessWidget {
  const RdcMapView({
    super.key,
    required this.features,
    this.contour,
    this.center,
    this.zoom,
    this.interactive = true,
    this.onOpenFullScreen,
  });

  final List<RdcMapFeature> features;
  final Json? contour;
  final LatLng? center;
  final double? zoom;
  final bool interactive;
  final VoidCallback? onOpenFullScreen;

  CameraFit? _fit() {
    final points = [
      for (final f in features) ..._allPoints(f.geometry),
      ..._allPoints(contour),
    ];
    if (points.isEmpty) return null;
    if (points.length == 1) return null;
    return CameraFit.coordinates(coordinates: points, padding: const EdgeInsets.all(36), maxZoom: zoom ?? 10);
  }

  void _showFeature(BuildContext context, RdcMapFeature f) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheet) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (f.image != null) ...[
                NetworkCover(url: f.image, height: 150, width: double.infinity),
                const SizedBox(height: 12),
              ],
              if (f.categorie.isNotEmpty)
                Text(f.categorie.toUpperCase(),
                    style: TextStyle(color: f.couleur, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.3)),
              const SizedBox(height: 4),
              Text(f.titre, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              if (f.libelleDates.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(f.libelleDates, style: const TextStyle(color: AppColors.textMuted, fontWeight: FontWeight.w600)),
                ),
              if (f.resume.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(f.resume, style: const TextStyle(color: AppColors.textSecondary, height: 1.4)),
                ),
              if (f.slug != null && f.kind != 'localite') ...[
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () {
                      Navigator.of(sheet).pop();
                      if (f.kind == 'province') {
                        openRdcProvince(context, f.slug!);
                      } else {
                        openRdcFiche(context, f.slug!);
                      }
                    },
                    child: Text(f.kind == 'province' ? 'Voir la province' : 'Lire la fiche'),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final polygons = <Polygon>[
      for (final ring in geoPolygons(contour))
        Polygon(points: ring, color: AppColors.primary.withValues(alpha: 0.08), borderColor: AppColors.navy, borderStrokeWidth: 2),
      for (final f in features)
        for (final ring in geoPolygons(f.geometry))
          Polygon(points: ring, color: f.couleur.withValues(alpha: 0.18), borderColor: f.couleur, borderStrokeWidth: 2),
    ];
    final polylines = <Polyline>[
      for (final f in features)
        for (final line in geoLines(f.geometry)) Polyline(points: line, color: f.couleur, strokeWidth: 4),
    ];
    final markers = <Marker>[
      for (final f in features)
        if (_anchor(f) case final point?)
          Marker(
            point: point,
            width: 40,
            height: 40,
            child: GestureDetector(
              onTap: interactive ? () => _showFeature(context, f) : null,
              child: Center(
                child: Semantics(
                  button: interactive,
                  label: f.titre,
                  child: Container(
                    width: f.kind == 'province' ? 14 : 18,
                    height: f.kind == 'province' ? 14 : 18,
                    decoration: BoxDecoration(
                      color: f.couleur,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2.5),
                      boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 4)],
                    ),
                  ),
                ),
              ),
            ),
          ),
    ];

    final fit = _fit();
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: Stack(
        children: [
          FlutterMap(
            options: MapOptions(
              initialCenter: center ?? (markers.length == 1 ? markers.first.point : rdcCenter),
              initialZoom: zoom ?? (markers.length == 1 ? 9 : 4.6),
              initialCameraFit: fit,
              minZoom: 3,
              maxZoom: 17,
              cameraConstraint: CameraConstraint.containCenter(bounds: _drcBounds),
              interactionOptions: InteractionOptions(
                flags: interactive ? InteractiveFlag.all & ~InteractiveFlag.rotate : InteractiveFlag.none,
              ),
              onTap: interactive || onOpenFullScreen == null ? null : (_, _) => onOpenFullScreen!(),
            ),
            children: [
              TileLayer(urlTemplate: AppConfig.mapTileUrl, userAgentPackageName: 'bnn.app.com'),
              if (polygons.isNotEmpty) PolygonLayer(polygons: polygons),
              if (polylines.isNotEmpty) PolylineLayer(polylines: polylines),
              MarkerLayer(markers: markers),
              const SimpleAttributionWidget(source: Text('OpenStreetMap')),
            ],
          ),
          if (onOpenFullScreen != null)
            Positioned(
              top: 8,
              right: 8,
              child: Material(
                color: Colors.white,
                shape: const CircleBorder(),
                elevation: 1,
                child: IconButton(
                  tooltip: 'Agrandir la carte',
                  icon: const Icon(CupertinoIcons.fullscreen, size: 18, color: AppColors.primary),
                  onPressed: onOpenFullScreen,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Carte en plein écran (depuis une fiche ou une province).
class RdcMapFullScreen extends StatelessWidget {
  const RdcMapFullScreen({super.key, required this.title, required this.features, this.contour, this.center, this.zoom});

  final String title;
  final List<RdcMapFeature> features;
  final Json? contour;
  final LatLng? center;
  final double? zoom;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(title)),
        body: Padding(
          padding: const EdgeInsets.all(8),
          child: RdcMapView(features: features, contour: contour, center: center, zoom: zoom),
        ),
      );
}
