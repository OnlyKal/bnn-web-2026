import 'dart:convert';

import 'package:flutter/services.dart';

import '../models/registration.dart';

/// Données locales du parcours d'inscription (provinces et établissements),
/// identiques à `province.json` et `etab_update.json` de BNN Web.
class RegistrationRepository {
  RegistrationRepository._();

  static final RegistrationRepository instance = RegistrationRepository._();

  List<Province>? _provinces;
  Map<String, List<Universite>>? _universites;

  Future<List<Province>> provinces() async {
    if (_provinces != null) return _provinces!;
    final raw = jsonDecode(await rootBundle.loadString('assets/data/province.json'));
    _provinces = ((raw as Map)['provinces'] as List)
        .map((e) => Province.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
    return _provinces!;
  }

  Future<Map<String, List<Universite>>> _all() async {
    if (_universites != null) return _universites!;
    final manifest = await AssetManifest.loadFromAssetBundle(rootBundle);
    final available = manifest.listAssets().toSet();
    final raw = jsonDecode(await rootBundle.loadString('assets/data/etab_update.json')) as Map;
    _universites = raw.map((key, value) {
      final list = (value as List).map((e) {
        final item = Map<String, dynamic>.from(e as Map);
        final path = item['path']?.toString();
        final asset = path == null ? null : 'assets/logos/${path.split('/').last}';
        return Universite(
          nom: item['name']?.toString() ?? '',
          shortname: (item['shortname'] ?? item['code'] ?? '').toString(),
          logoAsset: asset != null && available.contains(asset) ? asset : null,
        );
      }).toList();
      return MapEntry(key.toString(), list);
    });
    return _universites!;
  }

  /// Établissements de la province (comparaison sans accents ni casse),
  /// ou tous les établissements si la province est inconnue.
  Future<List<Universite>> universitesFor(Province? province) async {
    final all = await _all();
    if (province != null) {
      final target = normalize(province.nom);
      for (final entry in all.entries) {
        if (normalize(entry.key) == target) return entry.value;
      }
    }
    return all.values.expand((e) => e).toList();
  }

  static String normalize(String value) {
    const accents = {
      'à': 'a', 'â': 'a', 'ä': 'a', 'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
      'î': 'i', 'ï': 'i', 'ô': 'o', 'ö': 'o', 'ù': 'u', 'û': 'u', 'ü': 'u', 'ç': 'c',
    };
    final lower = value.toLowerCase();
    final buffer = StringBuffer();
    for (final char in lower.split('')) {
      buffer.write(accents[char] ?? char);
    }
    return buffer.toString().trim().replaceAll(RegExp(r'\s+'), '-');
  }
}
