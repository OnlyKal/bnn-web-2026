import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';

import '../../core/config.dart';
import '../../core/utils/json_utils.dart';

/// Évènement temps réel reçu du serveur (`{event, payload}`).
class SalonSocketEvent {
  const SalonSocketEvent(this.event, this.payload);

  final String event;
  final Json payload;

  String? get salonId => pickString(payload, ['salon_id', 'salon']);
}

/// Connexion WebSocket partagée des salons (`/ws/salons/?token=…`).
///
/// - un seul socket pour toute l'application, ouvert tant qu'un écran l'utilise ;
/// - reconnexion automatique avec délai croissant (sauf jeton refusé, code 4401) ;
/// - les abonnements aux salons sont rejoués après chaque reconnexion ;
/// - si le serveur n'est pas joignable, les écrans continuent en rafraîchissement périodique.
class SalonSocket {
  SalonSocket._();

  static final SalonSocket instance = SalonSocket._();

  final ValueNotifier<bool> connected = ValueNotifier(false);
  final _events = StreamController<SalonSocketEvent>.broadcast();
  final Map<String, int> _subscriptions = {};

  String? Function()? _token;
  WebSocket? _ws;
  Timer? _ping;
  Timer? _retry;
  int _attempt = 0;
  int _users = 0;
  bool _connecting = false;
  bool _refused = false;

  Stream<SalonSocketEvent> get events => _events.stream;

  /// À appeler dans `initState` ; [token] renvoie l'en-tête Authorization courant.
  void acquire(String? Function() token) {
    _token = token;
    _users++;
    if (_users == 1) {
      _refused = false;
      _connect();
    }
  }

  /// À appeler dans `dispose`.
  void release() {
    _users = max(0, _users - 1);
    if (_users == 0) _close();
  }

  void subscribe(String salonId) {
    _subscriptions[salonId] = (_subscriptions[salonId] ?? 0) + 1;
    if (_subscriptions[salonId] == 1) _send({'action': 'subscribe', 'salon_id': salonId});
  }

  void unsubscribe(String salonId) {
    final count = (_subscriptions[salonId] ?? 0) - 1;
    if (count > 0) {
      _subscriptions[salonId] = count;
      return;
    }
    _subscriptions.remove(salonId);
    _send({'action': 'unsubscribe', 'salon_id': salonId});
  }

  /// Le serveur peut retirer l'abonnement (salon quitté ou supprimé) :
  /// [resubscribe] le rétablit après une nouvelle adhésion.
  void resubscribe(String salonId) {
    if (_subscriptions.containsKey(salonId)) _send({'action': 'subscribe', 'salon_id': salonId});
  }

  void typing(String salonId) => _send({'action': 'typing', 'salon_id': salonId});

  static Uri? _url(String? authorization) {
    if (authorization == null || authorization.isEmpty) return null;
    final token = authorization.replaceFirst(RegExp(r'^(Bearer|Token)\s+'), '');
    final base = Uri.parse(AppConfig.apiServerUrl);
    return base.replace(
      scheme: base.scheme == 'https' ? 'wss' : 'ws',
      path: '/ws/salons/',
      queryParameters: {'token': token},
    );
  }

  Future<void> _connect() async {
    if (_connecting || _ws != null || _users == 0 || _refused) return;
    final url = _url(_token?.call());
    if (url == null) return;
    _connecting = true;
    try {
      final ws = await WebSocket.connect(url.toString()).timeout(const Duration(seconds: 10));
      _connecting = false;
      if (_users == 0) {
        await ws.close();
        return;
      }
      _ws = ws;
      _attempt = 0;
      connected.value = true;
      for (final id in _subscriptions.keys) {
        _send({'action': 'subscribe', 'salon_id': id});
      }
      _ping?.cancel();
      _ping = Timer.periodic(const Duration(seconds: 25), (_) => _send({'action': 'ping'}));
      ws.listen(
        _onData,
        onDone: () => _onClosed(ws, ws.closeCode),
        onError: (_) => _onClosed(ws, null),
        cancelOnError: true,
      );
    } catch (_) {
      _connecting = false;
      _scheduleRetry();
    }
  }

  void _onData(dynamic data) {
    if (data is! String) return;
    try {
      final json = asJson(jsonDecode(data));
      final event = pickString(json, ['event']);
      if (event == null || event == 'pong') return;
      _events.add(SalonSocketEvent(event, asJson(json?['payload']) ?? const {}));
    } catch (_) {
      // Message illisible : ignoré.
    }
  }

  void _onClosed(WebSocket ws, int? code) {
    if (!identical(_ws, ws)) return; // ancien socket déjà remplacé ou fermé volontairement
    _ws = null;
    _ping?.cancel();
    connected.value = false;
    if (code == 4401) {
      // Jeton refusé : pas de nouvelle tentative avant le prochain écran.
      _refused = true;
      return;
    }
    _scheduleRetry();
  }

  void _scheduleRetry() {
    if (_users == 0 || _refused) return;
    _retry?.cancel();
    final seconds = min(30, pow(2, _attempt).toInt());
    _attempt++;
    _retry = Timer(Duration(seconds: seconds), _connect);
  }

  void _send(Json message) {
    final ws = _ws;
    if (ws == null || ws.readyState != WebSocket.open) return;
    ws.add(jsonEncode(message));
  }

  void _close() {
    _retry?.cancel();
    _ping?.cancel();
    final ws = _ws;
    _ws = null;
    connected.value = false;
    ws?.close();
  }
}
