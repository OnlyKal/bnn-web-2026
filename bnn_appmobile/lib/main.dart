import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';

import 'app.dart';
import 'app_services.dart';
import 'core/storage/local_store.dart';
import 'state/session_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  Intl.defaultLocale = 'fr_FR';
  await initializeDateFormatting('fr_FR');
  await LocalStore.init();
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);

  final services = AppServices.create();
  final session = SessionController(
    storage: services.session,
    authService: services.auth,
    userService: services.users,
  );
  services.client.onSessionExpired = session.handleSessionExpired;

  runApp(BnnApp(services: services, session: session));
  session.restore();
}
