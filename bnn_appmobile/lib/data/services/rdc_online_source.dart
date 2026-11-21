import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart' show rootBundle;

import '../../core/network/api_exception.dart';
import '../../core/storage/local_store.dart';
import '../../core/utils/json_utils.dart';

/// Source « en ligne » de l'encyclopédie RDC : Wikidata (données, CC0) et
/// Wikipédia en français (textes et images, CC BY-SA 4.0).
///
/// Portage de `src/encyclopedie/online/wikiSource.js` (site Web) : même
/// catalogue (`assets/data/rdc_catalogue.json`), mêmes requêtes, et des réponses
/// de même forme que l'API BNN /api/bnn/rdc/, lues par les mêmes modèles.
class RdcOnlineSource {
  RdcOnlineSource({Dio? dio})
      : _dio = dio ??
            Dio(BaseOptions(
              connectTimeout: const Duration(seconds: 20),
              receiveTimeout: const Duration(seconds: 70),
              // Wikidata refuse les clients sans User-Agent identifiable.
              headers: {'User-Agent': _userAgent, 'Accept': 'application/json'},
            ));

  static const licenceNotice = 'Contenus issus de Wikipédia (licence CC BY-SA 4.0) et de Wikidata (CC0).';
  static const _userAgent = 'BNN-ESURSI-Mobile/1.0 (Bibliotheque Numerique Nationale RDC)';
  static const _sparqlUrl = 'https://query.wikidata.org/sparql';
  static const _wikiApi = 'https://fr.wikipedia.org/w/api.php';
  static const _wikiPage = 'https://fr.wikipedia.org/wiki/';
  static const _cachePrefix = 'rdc-online:v2:';
  static const _cacheTtl = Duration(hours: 24);
  static const pageSize = 20;

  final Dio _dio;
  _Catalogue? _catalogue;

  static const natures = {
    'article': 'Article thématique',
    'evenement': 'Événement',
    'personnalite': 'Personnalité',
    'institution': 'Institution / texte officiel',
    'lieu': 'Ville / lieu',
    'infrastructure': 'Infrastructure / ouvrage',
    'site_naturel': 'Parc / site naturel',
    'espece': 'Espèce (faune, flore)',
    'ressource': 'Ressource naturelle',
    'patrimoine': 'Patrimoine / culture',
  };

  static const _mois = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];

  Future<_Catalogue> _cat() async =>
      _catalogue ??= _Catalogue(jsonDecode(await rootBundle.loadString('assets/data/rdc_catalogue.json')) as Json);

  // ---------------------------------------------------------------- cache et réseau

  final Map<String, dynamic> _memory = {};
  final Map<String, Future<dynamic>> _inflight = {};

  dynamic _cacheGet(String key) {
    if (_memory.containsKey(key)) return _memory[key];
    try {
      final stored = asJson(LocalStore.instance.getJson('$_cachePrefix$key'));
      if (stored == null) return null;
      final time = DateTime.fromMillisecondsSinceEpoch(asInt(stored['time']) ?? 0);
      if (DateTime.now().difference(time) > _cacheTtl) return null;
      return _memory[key] = stored['data'];
    } catch (_) {
      return null;
    }
  }

  void _cacheSet(String key, dynamic data) {
    _memory[key] = data;
    try {
      LocalStore.instance.setJson('$_cachePrefix$key', {'time': DateTime.now().millisecondsSinceEpoch, 'data': data});
    } catch (_) {
      // Stockage indisponible : le cache mémoire suffit.
    }
  }

  /// Résultat mis en cache (mémoire + stockage local, 24 h). Non typé : relu
  /// depuis le stockage, il revient sous forme JSON générique (List/Map dynamiques).
  Future<dynamic> _cached(String key, Future<dynamic> Function() loader) async {
    final hit = _cacheGet(key);
    if (hit != null) return hit;
    final pending = _inflight[key];
    if (pending != null) return pending;
    final future = loader().then((data) {
      _cacheSet(key, data);
      return data;
    });
    _inflight[key] = future;
    try {
      return await future;
    } finally {
      _inflight.remove(key);
    }
  }

  Future<dynamic> _getJson(String url, Map<String, dynamic> query, {int attempt = 0}) async {
    try {
      final response = await _dio.get<dynamic>(url, queryParameters: query);
      final data = response.data;
      return data is String ? jsonDecode(data) : data;
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status == 429 && attempt < 2) {
        final retry = int.tryParse(e.response?.headers.value('retry-after') ?? '') ?? 2 + attempt * 3;
        await Future<void>.delayed(Duration(seconds: retry.clamp(1, 10)));
        return _getJson(url, query, attempt: attempt + 1);
      }
      // Erreur passagère du service (surcharge, délai dépassé) : une nouvelle tentative.
      if (status != null && const {500, 502, 503, 504}.contains(status) && attempt < 1) {
        await Future<void>.delayed(const Duration(milliseconds: 1500));
        return _getJson(url, query, attempt: attempt + 1);
      }
      if (status == 429) {
        throw ApiException('Les serveurs de Wikimedia sont momentanément saturés. Réessayez dans un instant.', statusCode: 429);
      }
      if (status == null && attempt < 1) {
        await Future<void>.delayed(const Duration(seconds: 2));
        return _getJson(url, query, attempt: attempt + 1);
      }
      if (status == null) throw ApiException('Impossible de joindre Wikipédia / Wikidata. Vérifiez votre connexion internet.');
      throw ApiException('Le chargement depuis Wikipédia / Wikidata a échoué.', statusCode: status);
    }
  }

  // Wikidata limite les requêtes simultanées : 3 au plus.
  int _activeSparql = 0;
  final List<Completer<void>> _sparqlQueue = [];

  Future<List<Map<String, String>>> _sparql(String query) async {
    if (_activeSparql >= 3) {
      final waiter = Completer<void>();
      _sparqlQueue.add(waiter);
      await waiter.future;
    } else {
      _activeSparql++;
    }
    try {
      final data = asJson(await _getJson(_sparqlUrl, {'format': 'json', 'query': query})) ?? {};
      final bindings = (asJson(data['results'])?['bindings'] as List?) ?? const [];
      return [
        for (final row in bindings)
          {for (final e in (row as Map).entries) e.key.toString(): (e.value as Map)['value'].toString()},
      ];
    } finally {
      if (_sparqlQueue.isNotEmpty) {
        _sparqlQueue.removeAt(0).complete();
      } else {
        _activeSparql--;
      }
    }
  }

  Future<Json> _wiki(Map<String, String> params) async =>
      asJson(await _getJson(_wikiApi, {'format': 'json', 'formatversion': '2', ...params})) ?? {};

  // ---------------------------------------------------------------- conversions

  static String? _qid(String? uri) => uri?.split('/').last;

  static Json? _coord(String? wkt) {
    final m = RegExp(r'Point\(([-\d.eE]+) ([-\d.eE]+)\)').firstMatch(wkt ?? '');
    if (m == null) return null;
    return {'longitude': double.parse(m.group(1)!), 'latitude': double.parse(m.group(2)!)};
  }

  static Json? _date(String? value) {
    final m = RegExp(r'^([+-]?)(\d+)-(\d\d)-(\d\d)').firstMatch(value ?? '');
    if (m == null) return null;
    return {
      'year': int.parse(m.group(2)!) * (m.group(1) == '-' ? -1 : 1),
      'month': int.parse(m.group(3)!),
      'day': int.parse(m.group(4)!),
      'raw': value,
    };
  }

  static String _formatDate(Json? d) {
    if (d == null) return '';
    final year = d['year'] as int;
    final y = year < 0 ? '${-year} av. J.-C.' : '$year';
    final month = d['month'] as int, day = d['day'] as int;
    // Wikidata code une précision « année » par le 1er janvier.
    if (month == 1 && day == 1) return y;
    if (day == 1) return '${_mois[month - 1]} $y';
    return '$day ${_mois[month - 1]} $y';
  }

  static String _libelleDates(Json? debut, Json? fin) {
    if (debut == null) return '';
    if (fin != null && fin['year'] != debut['year']) {
      String part(Json d) => (d['year'] as int) < 0 ? _formatDate(d) : '${d['year']}';
      return '${part(debut)} – ${part(fin)}';
    }
    return _formatDate(debut);
  }

  static String? _thumb(String? fileUrl, [int width = 640]) {
    if (fileUrl == null) return null;
    final file = Uri.decodeComponent(fileUrl.split('/Special:FilePath/').last);
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/${Uri.encodeComponent(file)}?width=$width';
  }

  static String? _articleTitle(String? url) =>
      url == null ? null : Uri.decodeComponent(url.replaceFirst(_wikiPage, '')).replaceAll('_', ' ');

  static String _norm(String s) {
    const map = {'à': 'a', 'â': 'a', 'ä': 'a', 'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'î': 'i', 'ï': 'i', 'ô': 'o', 'ö': 'o', 'ù': 'u', 'û': 'u', 'ü': 'u', 'ç': 'c', 'œ': 'oe'};
    return s.toLowerCase().split('').map((c) => map[c] ?? c).join();
  }

  // ---------------------------------------------------------------- requêtes des listes (deux temps)

  String _in(List<String> qids) => qids.map((q) => 'wd:$q').join(', ');
  String _values(List<String> qids) => qids.map((q) => 'wd:$q').join(' ');
  static const _frArticle = '?article_ schema:about ?i; schema:isPartOf <https://fr.wikipedia.org/>.';

  String _block(Json src, _Catalogue cat) {
    if (src['items'] != null) return '{ VALUES ?i { ${_values(_strings(src['items']))} } BIND("items" AS ?src) }';
    if (src['classes'] != null) {
      final article = src['article'] == true ? 'FILTER EXISTS { $_frArticle }' : '';
      return '{ ?i wdt:P17 wd:Q974; wdt:P31 ?cls. FILTER(?cls IN (${_in(_strings(src['classes']))})) $article BIND("classe" AS ?src) }';
    }
    if (src['poste'] != null) {
      return '{ ?i p:P39 ?mandat. ?mandat ps:P39 wd:${src['poste']}; pq:P580 ?mandatDebut. '
          'OPTIONAL { ?mandat pq:P582 ?mandatFin } BIND("poste" AS ?src) }';
    }
    if (src['propriete'] != null) {
      final p = _strings(src['propriete']);
      return '{ ?i wdt:${p[0]} wd:${p[1]}; wdt:P17 wd:Q974. BIND("propriete" AS ?src) }';
    }
    if (src['evenements'] == true) {
      return '{ VALUES ?pays { ${_values(cat.pays)} } ?i wdt:P17 ?pays; wdt:P585 ?evt. '
          'FILTER EXISTS { $_frArticle } FILTER NOT EXISTS { ?i wdt:P31 wd:Q5 } BIND("evenements" AS ?src) }';
    }
    return '';
  }

  static List<String> _strings(dynamic list) => list is List ? list.map((e) => e.toString()).toList() : const [];

  List<Json> _merge(List<Json> sources) {
    final strict = <String>{}, loose = <String>{}, items = <String>{};
    final others = <String, Json>{};
    for (final src in sources) {
      if (src['items'] != null) {
        items.addAll(_strings(src['items']));
      } else if (src['classes'] != null) {
        (src['article'] == true ? strict : loose).addAll(_strings(src['classes']));
      } else {
        others[jsonEncode(src)] = src;
      }
    }
    strict.removeAll(loose);
    return [
      ...others.values,
      if (strict.isNotEmpty) {'classes': strict.toList(), 'article': true},
      if (loose.isNotEmpty) {'classes': loose.toList(), 'article': false},
      if (items.isNotEmpty) {'items': items.toList()},
    ];
  }

  /// Étape 1 : identifiants (+ classes, origine, mandats).
  Future<List<Json>> _loadIds(List<Json> sources) async {
    final cat = await _cat();
    final merged = _merge(sources);
    final result = await _cached('ids:${jsonEncode(merged)}', () async {
      final rows = await _sparql('SELECT ?i ?cls ?src ?mandatDebut ?mandatFin WHERE { '
          '${merged.map((s) => _block(s, cat)).where((b) => b.isNotEmpty).join(' UNION ')} }');
      final byQid = <String, Json>{};
      for (final row in rows) {
        final qid = _qid(row['i']);
        if (qid == null) continue;
        final meta = byQid.putIfAbsent(qid, () => {'qid': qid, 'cls': <String>[], 'src': <String>[], 'mandats': <Json>[]});
        final cls = _qid(row['cls']);
        if (cls != null && !(meta['cls'] as List).contains(cls)) (meta['cls'] as List).add(cls);
        if (row['src'] != null && !(meta['src'] as List).contains(row['src'])) (meta['src'] as List).add(row['src']);
        if (row['mandatDebut'] != null) {
          (meta['mandats'] as List).add({'debut': _date(row['mandatDebut']), 'fin': _date(row['mandatFin'])});
        }
      }
      return byQid.values.toList();
    });
    return [for (final m in result as List) Map<String, dynamic>.from(m as Map)];
  }

  final Map<String, Json?> _details = {};

  /// Étape 2 : détails par lots de 120 identifiants, cache par élément.
  Future<Map<String, Json?>> _loadDetails(List<String> qids) async {
    final cat = await _cat();
    final missing = <String>[];
    for (final q in qids) {
      if (_details.containsKey(q)) continue;
      final stored = _cacheGet('det:$q');
      if (stored != null) {
        _details[q] = stored == false ? null : Map<String, dynamic>.from(stored as Map);
      } else {
        missing.add(q);
      }
    }
    final batches = <List<String>>[];
    for (var i = 0; i < missing.length; i += 120) {
      batches.add(missing.sublist(i, i + 120 > missing.length ? missing.length : i + 120));
    }
    await Future.wait(batches.map((batch) async {
      final rows = await _sparql('''
SELECT ?i ?label ?desc ?article ?coord ?img ?debut ?fin ?humain ?prov ?type WHERE {
  VALUES ?i { ${_values(batch)} }
  OPTIONAL { ?article schema:about ?i; schema:isPartOf <https://fr.wikipedia.org/> }
  OPTIONAL { ?i wdt:P625 ?coord }
  OPTIONAL { ?i wdt:P18 ?img }
  OPTIONAL { ?i wdt:P585|wdt:P580|wdt:P571|wdt:P1619|wdt:P569 ?debut }
  OPTIONAL { ?i wdt:P582|wdt:P576|wdt:P570 ?fin }
  OPTIONAL { ?i wdt:P31 wd:Q5. BIND(true AS ?humain) }
  OPTIONAL { ?i wdt:P31 ?type }
  OPTIONAL { VALUES ?prov { ${_values(cat.provinceQids)} } ?i wdt:P131* ?prov }
  OPTIONAL { ?i rdfs:label ?label FILTER(LANG(?label) = "fr") }
  OPTIONAL { ?i schema:description ?desc FILTER(LANG(?desc) = "fr") }
}''');
      final found = <String, Json>{};
      void push(Json d, String key, String? value) {
        final list = d[key] as List;
        if (value != null && !list.contains(value)) list.add(value);
      }

      for (final row in rows) {
        final qid = _qid(row['i'])!;
        final d = found.putIfAbsent(qid, () => {
              'titre': null, 'description': '', 'article': null, 'coord': null, 'image': null,
              'dates': <String>[], 'fins': <String>[], 'humain': false, 'provinces': <String>[], 'types': <String>[],
            });
        d['titre'] ??= row['label'];
        if ((d['description'] as String).isEmpty && row['desc'] != null) d['description'] = row['desc'];
        d['article'] ??= _articleTitle(row['article']);
        d['coord'] ??= _coord(row['coord']);
        d['image'] ??= _thumb(row['img']);
        if (row['humain'] != null) d['humain'] = true;
        push(d, 'dates', row['debut']);
        push(d, 'fins', row['fin']);
        push(d, 'provinces', _qid(row['prov']));
        push(d, 'types', _qid(row['type']));
      }
      for (final qid in batch) {
        _details[qid] = found[qid];
        _cacheSet('det:$qid', found[qid] ?? false);
      }
    }));
    return {for (final q in qids) q: _details[q]};
  }

  Json? _resolveSub(Json meta, Json? detail, List<Json> subs) {
    if (subs.isEmpty) return null;
    final classes = [..._strings(meta['cls']), ..._strings(detail?['types'])];
    final src = _strings(meta['src']);
    bool has(Json sub, bool Function(Json s) test) => (sub['sources'] as List).any((s) => test(Map<String, dynamic>.from(s as Map)));
    Json? first(bool Function(Json s) test) {
      for (final sub in subs) {
        if (has(sub, test)) return sub;
      }
      return null;
    }

    final byClass = first((s) => _strings(s['classes']).any(classes.contains));
    final explicit = first((s) => _strings(s['items']).contains(meta['qid']));
    // Une liste explicite précise la classe dans la même grande rubrique.
    if (byClass != null && explicit != null && explicit['racine'] == byClass['racine']) return explicit;
    return byClass ??
        explicit ??
        (src.contains('poste') ? first((s) => s['poste'] != null) : null) ??
        (src.contains('evenements') ? first((s) => s['evenements'] == true) : null) ??
        (src.contains('propriete') ? first((s) => s['propriete'] != null) : null);
  }

  /// Assemble identifiants + détails en éléments.
  Future<List<Json>> _build(List<Json> metas, Map<String, Json?> details, List<Json> subs) async {
    final cat = await _cat();
    final exclude = RegExp(cat.excludeEvents, caseSensitive: false);
    final items = <Json>[];
    for (final meta in metas) {
      final d = details[meta['qid']];
      if (d == null || d['titre'] == null) continue;
      final mandats = (meta['mandats'] as List).map((m) => Map<String, dynamic>.from(m as Map)).where((m) {
        if (m['debut'] == null) return false;
        if (m['fin'] == null) return true;
        final start = DateTime.tryParse((m['debut'] as Map)['raw'].toString().replaceFirst('+', ''));
        final end = DateTime.tryParse((m['fin'] as Map)['raw'].toString().replaceFirst('+', ''));
        return start == null || end == null || end.difference(start).inDays >= 7;
      }).toList()
        ..sort((a, b) => ((a['debut'] as Map)['year'] as int).compareTo((b['debut'] as Map)['year'] as int));
      if ((meta['mandats'] as List).isNotEmpty && mandats.isEmpty) continue;
      final src = _strings(meta['src']);
      if (src.length == 1 && src.first == 'evenements' && exclude.hasMatch(d['titre'] as String)) continue;
      final dates = _strings(d['dates']).map(_date).whereType<Json>().toList()
        ..sort((a, b) => (a['year'] as int).compareTo(b['year'] as int));
      final fins = _strings(d['fins']).map(_date).whereType<Json>().toList()
        ..sort((a, b) => (b['year'] as int).compareTo(a['year'] as int));
      final sub = _resolveSub(meta, d, subs) ?? cat.subForQid(meta['qid'] as String);
      if (sub == null) continue;
      items.add({
        ...d,
        'qid': meta['qid'],
        'sub': sub,
        'nature': d['humain'] == true ? 'personnalite' : sub['nature'],
        'debut': mandats.isNotEmpty ? Map<String, dynamic>.from(mandats.first['debut'] as Map) : (dates.isEmpty ? null : dates.first),
        'fin': mandats.isNotEmpty
            ? (mandats.last['fin'] == null ? null : Map<String, dynamic>.from(mandats.last['fin'] as Map))
            : (fins.isEmpty ? null : fins.first),
      });
    }
    return items;
  }

  /// Identifiants des éléments d'une province (on part de la province : quelques secondes).
  Future<List<Json>> _loadProvinceIds(List<Json> subs, String province) async {
    final merged = _merge([
      for (final s in subs) ...(s['sources'] as List).map((e) => Map<String, dynamic>.from(e as Map)),
    ]).where((src) => src['classes'] != null).toList();
    final classes = [for (final src in merged) ..._strings(src['classes'])];
    // Classes pour lesquelles le catalogue exige un article Wikipédia (cours d'eau, lacs…).
    final strict = {for (final src in merged.where((s) => s['article'] == true)) ..._strings(src['classes'])};
    final result = await _cached('ids-prov:$province:${classes.join(',')}', () async {
      final rows = await _sparql('SELECT DISTINCT ?i ?cls ?art WHERE { ?i wdt:P131* wd:$province. ?i wdt:P31 ?cls. '
          'FILTER(?cls IN (${_in(classes)})) '
          'OPTIONAL { ?art schema:about ?i; schema:isPartOf <https://fr.wikipedia.org/> } }');
      final byQid = <String, Json>{};
      for (final row in rows) {
        final qid = _qid(row['i'])!;
        final meta = byQid.putIfAbsent(
            qid, () => {'qid': qid, 'cls': <String>[], 'src': ['classe'], 'mandats': <Json>[], 'article': false});
        final cls = _qid(row['cls']);
        if (cls != null && !(meta['cls'] as List).contains(cls)) (meta['cls'] as List).add(cls);
        if (row['art'] != null) meta['article'] = true;
      }
      return byQid.values
          .where((m) => m['article'] == true || _strings(m['cls']).any((c) => !strict.contains(c)))
          .toList();
    });
    return [for (final m in result as List) Map<String, dynamic>.from(m as Map)];
  }

  Future<List<Json>> _itemsFor(List<Json> subs, {String? province, bool coords = false}) async {
    final metas = province != null
        ? await _loadProvinceIds(subs, province)
        : await _loadIds([for (final s in subs) ...(s['sources'] as List).map((e) => Map<String, dynamic>.from(e as Map))]);
    final details = await _loadDetails([for (final m in metas) m['qid'] as String]);
    var items = await _build(metas, details, subs);
    if (province != null) items = items.where((i) => _strings(i['provinces']).contains(province)).toList();
    if (coords) items = items.where((i) => i['coord'] != null).toList();
    return items;
  }

  Future<List<Json>> _itemsByQid(List<String> qids) async {
    final cat = await _cat();
    final details = await _loadDetails(qids);
    return _build([for (final q in qids) {'qid': q, 'cls': <String>[], 'src': ['items'], 'mandats': <Json>[]}], details, cat.subs);
  }

  /// Résumés et vignettes Wikipédia (lots de 20).
  Future<List<Json>> _enrich(List<Json> items) async {
    final titles = items.map((i) => i['article'] as String?).whereType<String>().toSet().toList();
    final extracts = <String, Json>{};
    for (var i = 0; i < titles.length; i += 20) {
      final batch = titles.sublist(i, i + 20 > titles.length ? titles.length : i + 20);
      final data = await _cached('extr:${batch.join('|')}', () async {
        final json = await _wiki({
          'action': 'query', 'prop': 'extracts|pageimages', 'titles': batch.join('|'), 'redirects': '1',
          'exintro': '1', 'explaintext': '1', 'exsentences': '2', 'exlimit': '20', 'piprop': 'thumbnail', 'pithumbsize': '480',
        });
        final query = asJson(json['query']) ?? {};
        final redirects = {for (final r in (query['redirects'] as List?) ?? const []) (r as Map)['to']: r['from']};
        return {
          for (final page in (query['pages'] as List?) ?? const [])
            (redirects[(page as Map)['title']] ?? page['title']).toString(): {
              'extract': page['extract'] ?? '',
              'thumb': (page['thumbnail'] as Map?)?['source'],
            },
        };
      });
      (data as Map).forEach((k, v) => extracts[k.toString()] = Map<String, dynamic>.from(v as Map));
    }
    return [
      for (final item in items)
        if (extracts[item['article']] case final extra?)
          {
            ...item,
            'resume': (extra['extract'] as String).isNotEmpty ? extra['extract'] : item['description'],
            'image': item['image'] ?? extra['thumb'],
          }
        else
          item,
    ];
  }

  Json? _periodeOf(_Catalogue cat, int? year) {
    if (year == null) return null;
    for (final p in cat.periodes) {
      final debut = asInt(p['annee_debut']);
      final fin = asInt(p['annee_fin']);
      if ((debut == null || year >= debut) && (fin == null || year < fin)) return p;
    }
    return null;
  }

  Json _fichePublic(_Catalogue cat, Json item) {
    final sub = asJson(item['sub']);
    final debut = asJson(item['debut']);
    final fin = asJson(item['fin']);
    final coord = asJson(item['coord']);
    return {
      'id': 0,
      'titre': item['titre'],
      'slug': item['qid'],
      'resume': item['resume'] ?? item['description'] ?? '',
      'categorie': sub == null ? null : cat.categoryRef(sub),
      'nature': item['nature'],
      'nature_label': natures[item['nature']] ?? natures['article'],
      'image': item['image'],
      'provinces': [
        for (final qid in _strings(item['provinces']))
          if (cat.provinceByQid[qid] case final p?) {'nom': p['nom'], 'slug': p['slug'], 'code': p['code']},
      ],
      'annee_debut': debut?['year'],
      'annee_fin': fin?['year'],
      'libelle_dates': _libelleDates(debut, fin),
      'periode_slug': _periodeOf(cat, debut?['year'] as int?)?['slug'],
      'latitude': coord?['latitude'],
      'longitude': coord?['longitude'],
    };
  }

  List<Json> _filter(_Catalogue cat, List<Json> items, Map<String, dynamic> params) {
    var list = items;
    final province = params['province'] as String?;
    if (province != null) {
      final qid = cat.provinceBySlug[province]?['qid'];
      list = list.where((i) => _strings(i['provinces']).contains(qid)).toList();
    }
    final nature = params['nature'] as String?;
    if (nature != null) list = list.where((i) => i['nature'] == nature).toList();
    final periode = params['periode'] as String?;
    if (periode != null) {
      final p = cat.periodes.where((x) => x['slug'] == periode).firstOrNull;
      if (p != null) {
        list = list.where((i) => i['debut'] != null && _periodeOf(cat, (i['debut'] as Map)['year'] as int)?['slug'] == periode).toList();
      }
    }
    if (params['vedette'] == true) list = list.where((i) => cat.vedette.contains(i['qid'])).toList();
    final q = (params['q'] as String?)?.trim() ?? '';
    if (q.isNotEmpty) {
      final words = _norm(q).split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
      list = list.where((i) {
        final hay = _norm('${i['titre']} ${i['description']} ${i['resume'] ?? ''}');
        return words.every(hay.contains);
      }).toList();
    }
    return list;
  }

  List<Json> _sort(List<Json> items, String? ordering) {
    int byTitle(Json a, Json b) => _norm(a['titre'] as String).compareTo(_norm(b['titre'] as String));
    int year(Json i, int fallback) => (asJson(i['debut'])?['year'] as int?) ?? fallback;
    final list = [...items];
    switch (ordering) {
      case 'chronologique':
        list.sort((a, b) => year(a, 1 << 30).compareTo(year(b, 1 << 30)) != 0 ? year(a, 1 << 30).compareTo(year(b, 1 << 30)) : byTitle(a, b));
      case 'recent':
        list.sort((a, b) => year(b, -(1 << 30)).compareTo(year(a, -(1 << 30))) != 0 ? year(b, -(1 << 30)).compareTo(year(a, -(1 << 30))) : byTitle(a, b));
      case 'populaire':
        int score(Json i) => (i['article'] != null ? 4 : 0) + (i['image'] != null ? 2 : 0) + (i['coord'] != null ? 1 : 0);
        list.sort((a, b) => score(b) != score(a) ? score(b).compareTo(score(a)) : byTitle(a, b));
      default:
        list.sort(byTitle);
    }
    return list;
  }

  Future<Json> _paginate(_Catalogue cat, List<Json> items, int page) async {
    final start = (page - 1) * pageSize;
    final slice = start >= items.length ? <Json>[] : items.sublist(start, (start + pageSize).clamp(0, items.length));
    final enriched = await _enrich(slice);
    final totalPages = (items.length / pageSize).ceil();
    return {
      'count': items.length,
      'page': page,
      'total_pages': totalPages,
      'results': [for (final i in enriched) _fichePublic(cat, i)],
    };
  }

  Future<Json> _searchWikipedia(_Catalogue cat, String q, {int offset = 0, int limit = pageSize}) async {
    final json = await _wiki({
      'action': 'query', 'generator': 'search', 'gsrsearch': '$q "république démocratique du Congo"', 'gsrnamespace': '0',
      'gsrlimit': '$limit', 'gsroffset': '$offset', 'prop': 'pageprops|extracts|pageimages', 'ppprop': 'wikibase_item',
      'exintro': '1', 'explaintext': '1', 'exsentences': '2', 'exlimit': '$limit', 'piprop': 'thumbnail', 'pithumbsize': '480',
    });
    final query = asJson(json['query']) ?? {};
    final pages = ((query['pages'] as List?) ?? const [])
        .map((p) => Map<String, dynamic>.from(p as Map))
        .where((p) => asJson(p['pageprops'])?['wikibase_item'] != null)
        .toList()
      ..sort((a, b) => (asInt(a['index']) ?? 0).compareTo(asInt(b['index']) ?? 0));
    final total = asInt(asJson(query['searchinfo'])?['totalhits']) ?? pages.length;
    return {
      'count': total,
      'has_more': json['continue'] != null,
      'results': [
        for (final page in pages)
          () {
            final qid = asJson(page['pageprops'])!['wikibase_item'].toString();
            final sub = cat.subForQid(qid);
            return _fichePublic(cat, {
              'qid': qid, 'titre': page['title'], 'description': '', 'resume': page['extract'] ?? '',
              'article': page['title'], 'image': asJson(page['thumbnail'])?['source'], 'provinces': <String>[],
              'sub': sub, 'nature': sub?['nature'] ?? 'article',
            });
          }(),
      ],
    };
  }

  // ---------------------------------------------------------------- API (mêmes formes que le serveur)

  Future<Json> accueil() async {
    final cat = await _cat();
    var vedette = <Json>[];
    try {
      vedette = await _enrich(await _itemsByQid(cat.vedette));
      vedette.sort((a, b) => cat.vedette.indexOf(a['qid'] as String).compareTo(cat.vedette.indexOf(b['qid'] as String)));
    } catch (_) {
      // La vedette est facultative : l'accueil s'affiche sans elle.
    }
    return {
      'categories': cat.tree(),
      'vedette': [for (final i in vedette) _fichePublic(cat, i)],
      'recentes': const [],
      'periodes': cat.periodesPublic(),
      'statistiques': {'provinces': cat.provinces.length, 'categories': cat.roots.length, 'fiches': null, 'medias': null},
      'source': 'wikimedia',
    };
  }

  Future<Json> filtres() async {
    final cat = await _cat();
    return {
      'categories': cat.tree(),
      'provinces': [for (final p in cat.provinces) {'nom': p['nom'], 'slug': p['slug']}],
      'natures': [for (final e in natures.entries) {'valeur': e.key, 'label': e.value}],
      'periodes': cat.periodesPublic(),
    };
  }

  Future<Json> categorie(String slug) async {
    final cat = await _cat();
    final sub = cat.subBySlug[slug];
    final root = sub != null ? cat.rootBySlug[sub['racine']] : cat.rootBySlug[slug];
    if (root == null) throw ApiException('Ce contenu est introuvable.', statusCode: 404);
    final self = sub != null ? cat.categoryPublic(sub, root) : cat.categoryPublic(root, null);
    return {
      ...self,
      'fil_ariane': sub != null ? [cat.categoryPublic(root, null)] : const [],
      'enfants': sub != null ? const [] : [for (final s in root['enfants'] as List) cat.categoryPublic(cat.subBySlug[(s as Map)['slug']]!, root)],
      'racine': cat.categoryPublic(root, null),
    };
  }

  Future<Json> fiches(Map<String, dynamic> params) async {
    final cat = await _cat();
    final page = asInt(params['page']) ?? 1;
    final q = (params['q'] as String?)?.trim() ?? '';
    final categorie = params['categorie'] as String?;
    if (q.isNotEmpty && categorie == null && params['province'] == null && params['nature'] == null && params['periode'] == null) {
      final result = await _searchWikipedia(cat, q, offset: (page - 1) * pageSize);
      final total = asInt(result['count']) ?? 0;
      return {'count': total, 'page': page, 'total_pages': (total / pageSize).ceil(), 'results': result['results']};
    }
    List<Json> items;
    if (params['vedette'] == true) {
      items = await _itemsByQid(cat.vedette);
    } else if (categorie == null) {
      items = await _itemsFor(cat.subs.where((s) => (s['sources'] as List).every((src) => (src as Map)['items'] != null)).toList());
    } else {
      items = await _itemsFor(cat.subsFor(categorie));
    }
    final ordering = params['ordering'] as String? ?? (q.isNotEmpty ? 'populaire' : 'titre');
    return _paginate(cat, _sort(_filter(cat, items, params), ordering), page);
  }

  Future<Json> chronologie(Map<String, dynamic> params) async {
    final cat = await _cat();
    final categorie = params['categorie'] as String?;
    final subs = categorie != null ? cat.subsFor(categorie) : cat.subs.where((s) => cat.rootBySlug[s['racine']]?['chronologie'] == true).toList();
    final items = (await _itemsFor(subs)).where((i) => i['debut'] != null).toList();
    final filtered = _sort(_filter(cat, items, params), 'chronologique');
    final page = await _enrich(filtered.take(400).toList());
    return {
      'periodes': cat.periodesPublic(),
      'count': filtered.length,
      'evenements': [for (final i in page) _fichePublic(cat, i)],
    };
  }

  Future<Json> carte(Map<String, dynamic> params) async {
    final cat = await _cat();
    final categorie = params['categorie'] as String?;
    final subs = categorie != null ? cat.subsFor(categorie) : cat.subs.where((s) => cat.rootBySlug[s['racine']]?['carte'] == true).toList();
    final province = params['province'] == null ? null : cat.provinceBySlug[params['province']]?['qid'] as String?;
    final items = await _itemsFor(subs, province: province, coords: true);
    final features = <Json>[
      for (final item in items)
        () {
          final sub = item['sub'] as Json;
          final root = cat.rootBySlug[sub['racine']]!;
          final coord = item['coord'] as Map;
          return {
            'type': 'Feature',
            'id': 'fiche-${item['qid']}',
            'geometry': {'type': 'Point', 'coordinates': [coord['longitude'], coord['latitude']]},
            'properties': {
              'type_objet': 'fiche', 'slug': item['qid'], 'titre': item['titre'], 'resume': item['description'] ?? '',
              'categorie': sub['nom'], 'couleur': root['couleur'], 'image': item['image'],
              'libelle_dates': _libelleDates(asJson(item['debut']), asJson(item['fin'])),
              'rubrique': root['nom'], 'rubrique_slug': root['slug'],
            },
          };
        }(),
      if (params['provinces'] == true)
        for (final p in cat.provinces)
          {
            'type': 'Feature',
            'id': 'province-${p['qid']}',
            'geometry': {'type': 'Point', 'coordinates': [p['longitude'], p['latitude']]},
            'properties': {'type_objet': 'province', 'slug': p['slug'], 'titre': p['nom'], 'resume': 'Chef-lieu : ${p['chef_lieu']}', 'couleur': '#053677'},
          },
    ];
    return {'type': 'FeatureCollection', 'features': features};
  }

  Future<List<Json>> _provincesData() async {
    final cat = await _cat();
    final data = await _cached('provinces', () async {
      final rows = await _sparql('''
SELECT ?p ?area ?pop ?popDate ?img ?article WHERE {
  VALUES ?p { ${_values(cat.provinceQids)} }
  OPTIONAL { ?p wdt:P2046 ?area }
  OPTIONAL { ?p p:P1082 ?ps. ?ps ps:P1082 ?pop. FILTER NOT EXISTS { ?ps wikibase:rank wikibase:DeprecatedRank } OPTIONAL { ?ps pq:P585 ?popDate } }
  OPTIONAL { ?p wdt:P18 ?img }
  OPTIONAL { ?article schema:about ?p; schema:isPartOf <https://fr.wikipedia.org/> }
}''');
      final out = <String, Json>{};
      for (final row in rows) {
        final e = out.putIfAbsent(_qid(row['p'])!, () => {});
        if (row['area'] != null) e['area'] ??= double.tryParse(row['area']!)?.round();
        final year = asInt(_date(row['popDate'])?['year']) ?? 0;
        if (row['pop'] != null && (e['pop'] == null || year > (asInt(e['popYear']) ?? 0))) {
          e['pop'] = double.tryParse(row['pop']!)?.round();
          e['popYear'] = year;
        }
        e['img'] ??= _thumb(row['img'], 480);
        e['article'] ??= _articleTitle(row['article']);
      }
      return out;
    });
    final map = Map<String, dynamic>.from(data as Map);
    return [
      for (final p in cat.provinces)
        () {
          final e = asJson(map[p['qid']]) ?? {};
          return {
            'nom': p['nom'], 'slug': p['slug'], 'code': p['code'], 'chef_lieu': p['chef_lieu'], 'presentation': '',
            'superficie_km2': e['area'], 'population': e['pop'], 'annee_population': (asInt(e['popYear']) ?? 0) > 0 ? e['popYear'] : null,
            'latitude': p['latitude'], 'longitude': p['longitude'], 'zoom': p['zoom'], 'image': e['img'], 'article': e['article'],
          };
        }(),
    ];
  }

  Future<Json> provinces() async => {'results': await _provincesData()};

  Future<Json> province(String slug) async {
    final cat = await _cat();
    final province = cat.provinceBySlug[slug];
    if (province == null) throw ApiException('Ce contenu est introuvable.', statusCode: 404);
    final cached = await _cached('province:$slug', () async {
      final base = (await _provincesData()).firstWhere((p) => p['slug'] == slug);
      final qid = province['qid'] as String;
      final results = await Future.wait<dynamic>([
        _article(base['article'] as String?).catchError((_) => <String, dynamic>{'html': '', 'intro': '', 'image': null}),
        _gallery(base['article'] as String?).catchError((_) => <Json>[]),
        _sparql('''
SELECT ?l ?label ?cls ?coord ?pop WHERE {
  VALUES ?cls { ${_values(cat.localites.keys.toList())} }
  ?l wdt:P31 ?cls; wdt:P131 wd:$qid.
  OPTIONAL { ?l wdt:P625 ?coord } OPTIONAL { ?l wdt:P1082 ?pop }
  ?l rdfs:label ?label FILTER(LANG(?label) = "fr")
}''').catchError((_) => <Map<String, String>>[]),
        _itemsFor(cat.subs.where((s) => cat.rootBySlug[s['racine']]?['carte'] == true).toList(), province: qid)
            .catchError((_) => <Json>[]),
      ]);
      final article = results[0] as Json;
      final localites = <String, Json>{};
      for (final row in results[2] as List<Map<String, String>>) {
        final id = _qid(row['l'])!;
        if (localites.containsKey(id)) continue;
        final type = cat.localites[_qid(row['cls'])] ?? 'territoire';
        final coord = _coord(row['coord']);
        localites[id] = {
          'nom': row['label'], 'type_label': type == 'ville' ? 'Ville' : 'Territoire',
          'population': row['pop'] == null ? null : double.tryParse(row['pop']!)?.round(),
          'latitude': coord?['latitude'], 'longitude': coord?['longitude'],
        };
      }
      final items = results[3] as List<Json>;
      final groups = <String, List<Json>>{};
      for (final item in items) {
        groups.putIfAbsent((item['sub'] as Json)['racine'] as String, () => []).add(item);
      }
      final rubriques = <Json>[];
      for (final root in cat.roots) {
        final list = groups[root['slug']];
        if (list == null) continue;
        final top = await _enrich(_sort(list, 'populaire').take(12).toList()).catchError((_) => list.take(12).toList());
        rubriques.add({'categorie': cat.categoryPublic(root, null), 'total': list.length, 'fiches': [for (final i in top) _fichePublic(cat, i)]});
      }
      return {
        ...base,
        'nb_fiches': items.length,
        'presentation': article['intro'],
        'description': article['html'],
        'langues': '',
        'image_principale': article['image'] ?? base['image'],
        'localites': localites.values.toList()..sort((a, b) => '${a['type_label']}${a['nom']}'.compareTo('${b['type_label']}${b['nom']}')),
        'medias': results[1],
        'sources': [
          if (base['article'] != null) _wikipediaSource(base['article'] as String),
          _wikidataSource(province['nom'] as String, qid),
        ],
        'donnees': const [],
        'rubriques': rubriques,
        'source': 'wikimedia',
      };
    });
    return Map<String, dynamic>.from(cached as Map);
  }

  Future<Json> fiche(String qid) async {
    if (!RegExp(r'^Q\d+$').hasMatch(qid)) throw ApiException('Ce contenu est introuvable.', statusCode: 404);
    final cat = await _cat();
    final cached = await _cached('fiche:$qid', () async {
      final items = await _itemsByQid([qid]);
      if (items.isEmpty) throw ApiException('Ce contenu est introuvable sur Wikidata.', statusCode: 404);
      final item = items.first;
      final sub = item['sub'] as Json;
      final root = cat.rootBySlug[sub['racine']]!;
      final article = item['article'] as String?;
      final results = await Future.wait<dynamic>([
        _facts(cat, qid).catchError((_) => <Json>[]),
        _article(article).catchError((_) => <String, dynamic>{'html': '', 'intro': '', 'image': null}),
        _gallery(article).catchError((_) => <Json>[]),
      ]);
      final text = results[1] as Json;
      var liees = <Json>[];
      try {
        final siblings = (await _itemsFor([sub])).where((i) => i['qid'] != qid && i['article'] != null).toList();
        liees = [for (final i in await _enrich(_sort(siblings, 'populaire').take(4).toList())) _fichePublic(cat, i)];
      } catch (_) {
        // Fiches liées facultatives.
      }
      final base = _fichePublic(cat, {...item, 'resume': (text['intro'] as String).isNotEmpty ? text['intro'] : item['description']});
      final periode = _periodeOf(cat, asJson(item['debut'])?['year'] as int?);
      return {
        ...base,
        'image': base['image'] ?? text['image'],
        'contenu': text['html'],
        'image_principale': text['image'] ?? item['image'],
        'credit_image': 'Wikimedia Commons',
        'fil_ariane': [cat.categoryPublic(root, null), cat.categoryPublic(sub, root)],
        'lieu': item['description'] ?? '',
        'localites': const [],
        'geometrie': null,
        'periode': periode == null ? null : cat.periodePublic(periode),
        'mots_cles': const [],
        'medias': results[2],
        'sources': [
          if (article != null) _wikipediaSource(article),
          _wikidataSource(item['titre'] as String, qid),
        ],
        'donnees': results[0],
        'fiches_liees': liees,
        'vues': 0,
        'source': 'wikimedia',
      };
    });
    return Map<String, dynamic>.from(cached as Map);
  }

  Json _wikipediaSource(String title) => {
        'type_label': 'Encyclopédie', 'titre': title, 'auteurs': 'Contributeurs de Wikipédia',
        'editeur': 'Wikipédia, l’encyclopédie libre', 'annee': '',
        'url': '$_wikiPage${Uri.encodeComponent(title.replaceAll(' ', '_'))}', 'note': 'Texte sous licence CC BY-SA 4.0',
      };

  Json _wikidataSource(String titre, String qid) => {
        'type_label': 'Base de données', 'titre': '$titre ($qid)', 'auteurs': 'Contributeurs de Wikidata',
        'editeur': 'Wikidata', 'annee': '', 'url': 'https://www.wikidata.org/wiki/$qid', 'note': 'Données sous licence CC0',
      };

  Future<List<Json>> _facts(_Catalogue cat, String qid) async {
    final rows = await _sparql('''
SELECT ?prop ?v ?vLabel ?unitLabel ?when WHERE {
  VALUES ?prop { ${cat.facts.map((f) => 'wd:${f[0]}').join(' ')} }
  ?prop wikibase:claim ?claim; wikibase:statementProperty ?sp; wikibase:statementValue ?sv.
  wd:$qid ?claim ?st. ?st ?sp ?v.
  FILTER NOT EXISTS { ?st wikibase:rank wikibase:DeprecatedRank }
  OPTIONAL { ?st ?sv ?node. ?node wikibase:quantityUnit ?unit. FILTER(?unit != wd:Q199) }
  OPTIONAL { ?st pq:P585 ?when }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}''');
    final labels = {for (final f in cat.facts) f[0]: f[1]};
    final entries = <String, Json>{};
    for (final row in rows) {
      final prop = _qid(row['prop'])!;
      final v = row['v'] ?? '';
      String value;
      if (RegExp(r'^[+-]?\d+-\d\d-\d\dT').hasMatch(v)) {
        value = _formatDate(_date(v));
      } else if (double.tryParse(v) != null) {
        final n = double.parse(v);
        final text = n == n.roundToDouble() ? n.round().toString() : n.toStringAsFixed(2);
        value = row['unitLabel'] == null ? text : '$text ${row['unitLabel']}';
      } else {
        value = row['vLabel'] ?? v;
      }
      if (value.isEmpty || RegExp(r'^Q\d+$').hasMatch(value) || value.startsWith('http')) continue;
      final entry = entries.putIfAbsent(prop, () => {'libelle': labels[prop], 'valeurs': <String>[], 'annee': ''});
      final when = asInt(_date(row['when'])?['year']);
      if (when != null && (entry['annee'] == '' || when > int.parse(entry['annee'] as String))) {
        entry['valeurs'] = <String>[value];
        entry['annee'] = '$when';
      } else if (!(entry['valeurs'] as List).contains(value)) {
        (entry['valeurs'] as List).add(value);
      }
    }
    return [
      for (final f in cat.facts)
        if (entries[f[0]] case final e?)
          {'libelle': e['libelle'], 'valeur': (e['valeurs'] as List).take(4).join(', '), 'unite': '', 'annee': e['annee']},
    ];
  }

  Future<Json> _article(String? title) async {
    if (title == null) return {'html': '', 'intro': '', 'image': null};
    final json = await _wiki({
      'action': 'query', 'prop': 'extracts|pageimages', 'titles': title, 'redirects': '1',
      'exsectionformat': 'wiki', 'piprop': 'original|thumbnail', 'pithumbsize': '800',
    });
    final pages = (asJson(json['query'])?['pages'] as List?) ?? const [];
    final page = pages.isEmpty ? <String, dynamic>{} : Map<String, dynamic>.from(pages.first as Map);
    var html = page['extract']?.toString() ?? '';
    final cut = RegExp(r'<h2[^>]*>\s*(?:<span[^>]*>)?\s*(Notes et références|Notes|Références|Voir aussi|Liens externes|Bibliographie|Annexes)', caseSensitive: false)
        .firstMatch(html);
    if (cut != null && cut.start > 0) html = html.substring(0, cut.start);
    html = html.replaceAll(RegExp(r'<p[^>]*class="mw-empty-elt"[^>]*>\s*</p>'), '');
    // Le premier paragraphe sert de chapeau : retiré du corps pour ne pas l'afficher deux fois.
    final first = RegExp(r'<p>[\s\S]*?</p>').firstMatch(html);
    final intro = first?.group(0)?.replaceAll(RegExp(r'<[^>]+>'), '').trim() ?? '';
    if (first != null) html = html.replaceFirst(first.group(0)!, '');
    return {
      'html': html,
      'intro': intro,
      'image': asJson(page['thumbnail'])?['source'] ?? asJson(page['original'])?['source'],
    };
  }

  static final _excludedImage = RegExp(
    r'(logo|flag|drapeau|icon|icone|blason|coat[_ ]of|seal|symbol|pictogram|commons-|wiki|edit-|question|disambig|portal|star|nuvola|crystal|loudspeaker|padlock|red_pencil)',
    caseSensitive: false,
  );

  Future<List<Json>> _gallery(String? title) async {
    if (title == null) return [];
    final json = await _wiki({
      'action': 'query', 'generator': 'images', 'titles': title, 'redirects': '1', 'gimlimit': '40',
      'prop': 'imageinfo', 'iiprop': 'url|mime|extmetadata', 'iiurlwidth': '1000',
      'iiextmetadatafilter': 'Artist|LicenseShortName|ImageDescription', 'iiextmetadatalanguage': 'fr',
    });
    String strip(dynamic html) => (html?.toString() ?? '').replaceAll(RegExp(r'<[^>]+>'), '').replaceAll(RegExp(r'\s+'), ' ').trim();
    final out = <Json>[];
    for (final raw in (asJson(json['query'])?['pages'] as List?) ?? const []) {
      final page = Map<String, dynamic>.from(raw as Map);
      final title = page['title']?.toString() ?? '';
      final infos = page['imageinfo'] as List?;
      if (infos == null || infos.isEmpty || _excludedImage.hasMatch(title)) continue;
      final info = Map<String, dynamic>.from(infos.first as Map);
      final mime = info['mime']?.toString() ?? '';
      final isVideo = mime.startsWith('video/');
      if (!isVideo && !RegExp(r'^image/(jpeg|png|webp)').hasMatch(mime)) continue;
      if (!isVideo && (asInt(info['width']) ?? 1000) < 200) continue;
      final meta = asJson(info['extmetadata']) ?? {};
      final name = title.replaceFirst('Fichier:', '').replaceFirst(RegExp(r'\.[a-z0-9]+$', caseSensitive: false), '');
      final isMap = RegExp(r'(carte|map|location|localisation|relief)', caseSensitive: false).hasMatch(title);
      out.add({
        'id': out.length,
        'type': isVideo ? 'video' : (isMap ? 'carte' : 'image'),
        'type_label': isVideo ? 'Vidéo' : (isMap ? 'Carte' : 'Photographie'),
        'titre': name.replaceAll(RegExp(r'[_-]+'), ' '),
        'legende': strip(asJson(meta['ImageDescription'])?['value']),
        'url': isVideo ? info['url'] : (info['thumburl'] ?? info['url']),
        'vignette': isVideo ? null : (info['thumburl'] ?? info['url']),
        'credit': [strip(asJson(meta['Artist'])?['value']), asJson(meta['LicenseShortName'])?['value']?.toString() ?? '']
            .where((e) => e.isNotEmpty)
            .join(' · '),
      });
      if (out.length >= 24) break;
    }
    return out;
  }
}

/// Index du catalogue partagé avec le site Web.
class _Catalogue {
  _Catalogue(this.raw) {
    roots = [for (final r in raw['categories'] as List) Map<String, dynamic>.from(r as Map)];
    for (final root in roots) {
      rootBySlug[root['slug'] as String] = root;
      for (final s in root['enfants'] as List) {
        final sub = {...Map<String, dynamic>.from(s as Map), 'racine': root['slug']};
        subs.add(sub);
        subBySlug[sub['slug'] as String] = sub;
      }
    }
    provinces = [for (final p in raw['provinces'] as List) Map<String, dynamic>.from(p as Map)];
    for (final p in provinces) {
      provinceByQid[p['qid'] as String] = p;
      provinceBySlug[p['slug'] as String] = p;
    }
    periodes = [for (final p in raw['periodes'] as List) Map<String, dynamic>.from(p as Map)];
  }

  final Json raw;
  late final List<Json> roots;
  final List<Json> subs = [];
  final Map<String, Json> rootBySlug = {};
  final Map<String, Json> subBySlug = {};
  late final List<Json> provinces;
  final Map<String, Json> provinceByQid = {};
  final Map<String, Json> provinceBySlug = {};
  late final List<Json> periodes;

  List<String> get pays => RdcOnlineSource._strings(raw['pays']);
  List<String> get vedette => RdcOnlineSource._strings(raw['vedette']);
  List<String> get provinceQids => [for (final p in provinces) p['qid'] as String];
  String get excludeEvents => raw['exclure_evenements'] as String;
  Map<String, String> get localites => {for (final e in (raw['localites'] as Map).entries) e.key.toString(): e.value.toString()};
  List<List<String>> get facts => [for (final f in raw['faits'] as List) RdcOnlineSource._strings(f)];

  List<Json> subsFor(String slug) {
    if (subBySlug[slug] != null) return [subBySlug[slug]!];
    if (rootBySlug[slug] != null) return subs.where((s) => s['racine'] == slug).toList();
    return [];
  }

  Json? subForQid(String qid) {
    for (final sub in subs) {
      if ((sub['sources'] as List).any((s) => RdcOnlineSource._strings((s as Map)['items']).contains(qid))) return sub;
    }
    return null;
  }

  Json categoryRef(Json sub) {
    final root = rootBySlug[sub['racine']] ?? sub;
    return {'nom': sub['nom'], 'slug': sub['slug'], 'icone': root['icone'], 'couleur': root['couleur']};
  }

  Json categoryPublic(Json cat, Json? root) {
    final r = root ?? cat;
    return {
      'id': 0,
      'nom': cat['nom'],
      'slug': cat['slug'],
      'description': cat['description'] ?? '',
      'icone': r['icone'],
      'couleur': r['couleur'],
      'afficher_carte': r['carte'] == true,
      'afficher_chronologie': r['chronologie'] == true,
      'nb_fiches': null,
    };
  }

  List<Json> tree() => [
        for (final root in roots)
          {
            ...categoryPublic(root, null),
            'enfants': [for (final s in subs.where((s) => s['racine'] == root['slug'])) categoryPublic(s, root)],
          },
      ];

  Json periodePublic(Json p) => {
        'nom': p['nom'],
        'slug': p['slug'],
        'annee_debut': p['annee_debut'],
        'annee_fin': p['annee_fin'],
        'libelle_dates': '${p['annee_debut'] ?? '…'} – ${p['annee_fin'] ?? "aujourd'hui"}',
        'couleur': p['couleur'],
        'resume': '',
      };

  List<Json> periodesPublic() => [for (final p in periodes) periodePublic(p)];
}
