import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'app_services.dart';
import 'core/theme/app_theme.dart';
import 'state/favorites_controller.dart';
import 'state/history_controller.dart';
import 'state/session_controller.dart';
import 'ui/screens/auth/login_screen.dart';
import 'ui/screens/shell/main_shell.dart';
import 'ui/screens/splash/splash_screen.dart';

final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

class BnnApp extends StatelessWidget {
  const BnnApp({super.key, required this.services, required this.session});

  final AppServices services;
  final SessionController session;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<AppServices>.value(value: services),
        ChangeNotifierProvider<SessionController>.value(value: session),
        ChangeNotifierProvider<HistoryController>(create: (_) => HistoryController()),
        ChangeNotifierProvider<FavoritesController>(
          create: (_) => FavoritesController(services.favoris),
        ),
      ],
      child: MaterialApp(
        title: 'BNN ESURSI',
        debugShowCheckedModeBanner: false,
        navigatorKey: rootNavigatorKey,
        theme: AppTheme.light(),
        locale: const Locale('fr', 'FR'),
        supportedLocales: const [Locale('fr', 'FR')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        builder: (context, child) {
          // Limite l'agrandissement du texte pour préserver les mises en page,
          // tout en respectant les réglages d'accessibilité de l'utilisateur.
          final media = MediaQuery.of(context);
          return MediaQuery(
            data: media.copyWith(
              textScaler: media.textScaler.clamp(maxScaleFactor: 1.35),
            ),
            child: child!,
          );
        },
        home: const AuthGate(),
      ),
    );
  }
}

/// Aiguille vers l'écran de démarrage, la connexion ou l'application.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  SessionStatus? _lastStatus;

  @override
  Widget build(BuildContext context) {
    final status = context.select<SessionController, SessionStatus>((s) => s.status);
    if (_lastStatus != null && _lastStatus != status) {
      // Changement d'état (connexion / déconnexion / expiration) :
      // on ferme les écrans empilés au-dessus de la porte d'entrée.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        rootNavigatorKey.currentState?.popUntil((route) => route.isFirst);
      });
    }
    _lastStatus = status;

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 350),
      child: switch (status) {
        SessionStatus.unknown => const SplashScreen(key: ValueKey('splash')),
        SessionStatus.unauthenticated => const LoginScreen(key: ValueKey('login')),
        SessionStatus.authenticated => const MainShell(key: ValueKey('shell')),
      },
    );
  }
}
