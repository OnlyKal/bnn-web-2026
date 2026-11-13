# BNN ESURSI — application mobile

Application Flutter (Android / iOS) de la Bibliothèque Numérique Nationale. Elle reprend les
fonctionnalités de BNN Web (`../src`) et utilise la même API (`https://admin-bnn.minesursi.gouv.cd/api/bnn`
et le proxy HAL `/api/hal`).

## Démarrage

```bash
flutter pub get
flutter run                       # API de production
flutter run --dart-define=API_SERVER_URL=http://10.0.2.2:8000   # API locale (émulateur Android)
flutter analyze && flutter test   # vérifications
```

Flutter 3.35 / Dart 3.9 minimum.

## Fonctionnalités

| # | Fonctionnalité | Écrans (`lib/ui/screens/`) |
|---|---|---|
| 1 | Fondations : client HTTP (jeton, renouvellement sur 401), session sécurisée (Keychain/Keystore, expiration 24 h), thème BNN | `app.dart`, `core/` |
| 2 | Connexion | `auth/login_screen.dart` |
| 3 | Inscription : province → établissement → type d'utilisateur → formulaire | `registration/` |
| 4 | Mot de passe oublié | `auth/reset_password_screen.dart` |
| 5 | Navigation principale (5 onglets, badges favoris / historique) | `shell/main_shell.dart` |
| 6 | Accueil : ressources internes, recherche + suggestions, filtres type / domaine, ajouts récents, annonce Salons | `home/` |
| 7 | Ressources externes HAL : recherche, filtres (langue, type, domaine, avancés) | `home/external_resources_view.dart` |
| 8 | Fiche ressource, favoris, enregistrement des consultations | `resource/` |
| 9 | Lecteurs intégrés PDF, EPUB et vidéo (consultation uniquement, aucun fichier enregistré) | `viewers/` |
| 10 | Favoris (serveur + HAL locaux par compte) | `favorites/` |
| 11 | Historique local | `history/` |
| 12 | Salons : liste, création, adhésion, messages, pièces jointes, membres, notifications | `salons/` |
| 13 | Profil : avatar, modification, mot de passe, actions rapides | `profile/` |
| 14 | Rapports statistiques (administrateurs) avec export PDF / Excel | `stats/` |

## Architecture

```
lib/
  core/      configuration, thème, réseau, stockage, utilitaires (sans dépendance UI)
  data/      modèles tolérants aux formats de l'API, services HTTP, parseur EPUB
  state/     contrôleurs ChangeNotifier (session, favoris, historique, listes)
  ui/        écrans et composants réutilisables (widgets/)
```

- Injection : `AppServices` (services) et `provider` (contrôleurs). Chaque service peut être remplacé
  par une implémentation simulée (voir `test/fakes.dart`).
- Les logos des établissements (`assets/logos/`) sont redimensionnés à 160 px (4 Mo au lieu de 55 Mo).
- Couleurs : charte BNN Web (`#1E42AC`, `#053677`, `#0A1F38`) dans `core/theme/app_colors.dart`.

## Tests

`test/` couvre les utilitaires, la gestion d'erreurs, les modèles, le parseur EPUB, les exports,
les contrôleurs et les parcours principaux (connexion, inscription, accueil, fiche, favoris,
historique, salons, profil, statistiques) avec des services simulés.
