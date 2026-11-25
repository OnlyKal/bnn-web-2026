import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';

import '../app.dart';
import '../core/network/api_exception.dart';
import '../data/services/salons_service.dart';
import '../ui/screens/salons/salon_detail_screen.dart';
import '../ui/widgets/feedback.dart';
import 'session_controller.dart';

/// Ouvre dans l'application les liens d'invitation des salons
/// (https://bnn.minesursi.gouv.cd/salons?invitation=…).
///
/// Sur un téléphone où l'app est installée, le système lui confie le lien
/// (liens universels iOS, App Links Android) au lieu d'ouvrir le navigateur.
/// Si la personne n'est pas connectée, l'invitation attend la connexion.
class SalonInvitationLinks {
  SalonInvitationLinks({required this.salons, required this.session, AppLinks? appLinks})
      : _appLinks = appLinks ?? AppLinks();

  final SalonsService salons;
  final SessionController session;
  final AppLinks _appLinks;

  StreamSubscription<Uri>? _sub;
  String? _pendingToken;
  bool _busy = false;

  Future<void> start() async {
    session.addListener(_onSessionChanged);
    _sub = _appLinks.uriLinkStream.listen(_onUri, onError: (_) {});
    try {
      final initial = await _appLinks.getInitialLink();
      if (initial != null) _onUri(initial);
    } catch (_) {
      // Pas de lien au démarrage : rien à faire.
    }
  }

  void dispose() {
    _sub?.cancel();
    session.removeListener(_onSessionChanged);
  }

  void _onUri(Uri uri) {
    if (!uri.path.startsWith('/salons')) return;
    final token = SalonsService.invitationTokenFrom(uri.toString());
    if (token == null) return;
    _pendingToken = token;
    _process();
  }

  void _onSessionChanged() {
    if (session.isAuthenticated) _process();
  }

  Future<void> _process() async {
    final token = _pendingToken;
    if (token == null || _busy || !session.isAuthenticated) return;
    _busy = true;
    _pendingToken = null;
    // Laisse l'écran d'accueil s'installer (la porte d'entrée referme les écrans
    // empilés quand la session change), puis ouvre le salon par-dessus.
    await Future<void>.delayed(const Duration(milliseconds: 700));
    try {
      final (salonId, message) = await salons.joinByInvitation(token);
      final navigator = rootNavigatorKey.currentState;
      final context = rootNavigatorKey.currentContext;
      if (context != null && context.mounted) showSuccess(context, message);
      await navigator?.push(MaterialPageRoute(builder: (_) => SalonDetailScreen(salonId: salonId)));
    } on ApiException catch (e) {
      final context = rootNavigatorKey.currentContext;
      if (context != null && context.mounted) showError(context, e.message);
    } finally {
      _busy = false;
    }
  }
}
