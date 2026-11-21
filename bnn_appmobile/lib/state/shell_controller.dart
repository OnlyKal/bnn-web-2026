import 'package:flutter/foundation.dart';

enum AppTab { home, rdc, favorites, salons, history, profile }

/// Onglet actif de la navigation principale (permet de changer d'onglet
/// depuis n'importe quel écran : annonce des salons, historique…).
class ShellController extends ChangeNotifier {
  AppTab _tab = AppTab.home;

  /// Recherche à appliquer à l'accueil (ouverte depuis l'historique).
  String? pendingHomeSearch;

  AppTab get tab => _tab;

  void goTo(AppTab tab) {
    if (_tab == tab) return;
    _tab = tab;
    notifyListeners();
  }

  void openHomeSearch(String query) {
    pendingHomeSearch = query;
    _tab = AppTab.home;
    notifyListeners();
  }

  String? consumeHomeSearch() {
    final query = pendingHomeSearch;
    pendingHomeSearch = null;
    return query;
  }
}
