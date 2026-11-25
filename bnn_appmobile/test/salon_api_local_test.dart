// Parcours complet du Salon contre un serveur Django de TEST local.
// Ignoré par défaut. Pour le lancer :
//   flutter test test/salon_api_local_test.dart \
//     --dart-define=API_SERVER_URL=http://127.0.0.1:8765 --dart-define=SALON_E2E=true
// Comptes attendus sur le serveur de test : createur, invitee, mobile (mot de passe SALON_E2E_PASSWORD).
import 'dart:async';

import 'package:bnn_appmobile/core/config.dart';
import 'package:bnn_appmobile/core/network/api_client.dart';
import 'package:bnn_appmobile/core/storage/session_storage.dart';
import 'package:bnn_appmobile/data/services/salon_socket.dart';
import 'package:bnn_appmobile/data/services/salons_service.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

const _enabled = bool.fromEnvironment('SALON_E2E');
const _password = String.fromEnvironment('SALON_E2E_PASSWORD', defaultValue: 'TestLocal123!');

class _TestSession extends SessionStorage {
  String? value;

  @override
  String? get authorizationHeader =>
      value == null ? null : (RegExp(r'^(Bearer|Token) ').hasMatch(value!) ? value : 'Bearer $value');
}

Future<SalonsService> _as(String username) async {
  final dio = Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl));
  final r = await dio.post<dynamic>('/user/signin/', data: {'username': username, 'password': _password});
  final body = r.data as Map;
  final session = _TestSession()..value = (body['token'] ?? (body['data'] as Map)['token']) as String;
  return SalonsService(ApiClient(session));
}

Future<String> _token(String username) async {
  final dio = Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl));
  final r = await dio.post<dynamic>('/user/signin/', data: {'username': username, 'password': _password});
  final body = r.data as Map;
  return (body['token'] ?? (body['data'] as Map)['token']) as String;
}

void main() {
  test('Salon : parcours complet depuis le service mobile', () async {
    final createur = await _as('createur');
    final mobile = await _as('mobile');

    // Liste et détail.
    final salons = (await createur.list()).salons;
    final prive = salons.firstWhere((s) => s.prive);
    final public = salons.firstWhere((s) => !s.prive);

    // Salon privé : lien d'invitation généré par le serveur, puis adhésion par le lien.
    final link = await createur.invitationLink(prive.id);
    expect(link, startsWith(SalonsService.webSalonsUrl));
    final token = SalonsService.invitationTokenFrom(link)!;
    final (joinedId, _) = await mobile.joinByInvitation(token);
    expect(joinedId, prive.id);
    final membres = await createur.members(prive.id);
    expect(membres.membres.map((m) => m.user.username), contains('mobile'));
    expect(() => mobile.joinByInvitation('${token}x'), throwsA(anything));

    // Salon public : rejoindre, lire, temps réel, réponse, mention, épingler, signaler.
    await mobile.join(public.id);
    final page = await mobile.messages(public.id);
    expect(page.messages, isNotEmpty);

    final socket = SalonSocket.instance;
    final creatorToken = await _token('createur');
    final received = Completer<SalonSocketEvent>();
    final sub = socket.events.listen((e) {
      if (e.salonId == public.id && !received.isCompleted && e.event.contains('message')) received.complete(e);
    });
    socket.acquire(() => creatorToken);
    socket.subscribe(public.id);
    await Future<void>.delayed(const Duration(seconds: 2));
    expect(socket.connected.value, isTrue, reason: 'WebSocket non connecté');

    final sent = await mobile.send(public.id, text: 'Réponse de test @createur', replyTo: page.messages.last.id);
    expect(sent, isNotNull);
    final event = await received.future.timeout(const Duration(seconds: 5));
    expect(event.salonId, public.id);
    await sub.cancel();
    socket.release();

    final edited = await mobile.editMessage(public.id, sent!.id, 'Réponse modifiée @createur');
    expect(edited?.contenu, contains('modifiée'));
    expect(await createur.pinMessage(public.id, sent.id, pinned: true), isTrue);
    await mobile.reportMessage(public.id, page.messages.first.id, 'test');
    final reports = await createur.reports(public.id);
    expect(reports, isNotEmpty);
    await createur.resolveReport(public.id, reports.first.id);
    await createur.markRead(public.id);
    final notifs = await createur.notifications();
    expect(notifs.items.where((n) => n.type == 'mention'), isNotEmpty);
    await mobile.deleteMessage(public.id, sent.id);
  }, skip: _enabled ? false : 'Serveur de test local requis (SALON_E2E=true)');
}
