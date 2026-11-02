# API utilisées par l'application mobile BNN

Serveur : `https://admin.cgiibnn-esursi.cd` (modifiable avec `--dart-define=API_SERVER_URL=...`).

- **API BNN** : `{serveur}/api/bnn` — en-tête `Authorization: Bearer <jeton>` sauf mention « public ».
- **API HAL** : `{serveur}/api/hal` — publique, sans jeton.

## Authentification — `lib/data/services/auth_service.dart`

| Méthode | Endpoint | Commentaire |
|---|---|---|
| POST | `/user/signin/` | Connexion (public) : `username`, `password`. Renvoie le jeton et l'utilisateur ; 400/401 → « identifiants incorrects ». |
| POST | `/user/signup/` | Inscription (public) : identité, rôle, université, faculté, date de naissance. Peut renvoyer un jeton (connexion directe). |
| PUT | `/user/password-reset/` | Mot de passe oublié (public) : `email`. Le nouveau mot de passe est envoyé par email. |
| POST | `/auth/refresh/` | Renouvelle le jeton, appelé automatiquement après un 401 (`lib/core/network/api_client.dart`). |
| POST | `/auth/logout/` | Déconnexion côté serveur ; la session locale est effacée même si l'appel échoue. |

## Utilisateur — `lib/data/services/user_service.dart`

| Méthode | Endpoint | Commentaire |
|---|---|---|
| GET | `/user/profile/` | Profil à jour, rechargé après connexion et au démarrage. |
| PUT | `/user/update/` | Modifie nom, prénom, téléphone, email et rôle. |
| PUT | `/user/password/` | Change le mot de passe : `old_password`, `new_password`. |
| PATCH | `/user/avatar/` | Nouvelle photo de profil, envoyée en base64 (`data:image/...;base64,...`, 5 Mo max). |

## Ressources internes — `lib/data/services/ressources_service.dart`

| Méthode | Endpoint | Commentaire |
|---|---|---|
| GET | `/ressources/` | Liste paginée par curseur (`?cursor=`), filtrable par `?type=` ; fournit aussi le total et le nombre par type. |
| GET | `/ressources/search/` | Recherche serveur : `q`, `limit` (50), `offset` ; repli sur une recherche locale si aucun résultat. |
| GET | `/ressource/all/` | Toutes les ressources (appel lourd, cache 10 min) ; sert uniquement à retrouver une ressource par son id. |
| GET | `/domaines/` | Liste des domaines pour le filtre (cache 15 min). |
| GET | `/domaines/{id}/ressources/` | Ressources d'un domaine (cache 10 min) ; repli sur un filtrage local en cas d'échec. |
| POST | `/consultations/` | Enregistre l'ouverture d'un fichier : `ressource_id`. N'interrompt jamais l'utilisateur en cas d'échec. |

## Favoris — `lib/data/services/favoris_service.dart`

| Méthode | Endpoint | Commentaire |
|---|---|---|
| GET | `/favoris/` | Favoris internes de l'utilisateur. Les favoris HAL sont stockés sur l'appareil, pas sur le serveur. |
| POST | `/favoris/` | Ajoute un favori : `ressource_id`. Un 409 (déjà en favori) est traité comme un succès. |
| DELETE | `/favoris/{ressource_id}/` | Retire un favori (identifiant de la ressource, pas du favori). |

## Salons — `lib/data/services/salons_service.dart`

| Méthode | Endpoint | Commentaire |
|---|---|---|
| GET | `/salons/` | Liste des salons, recherche avec `?search=`. |
| POST | `/salons/` | Crée un salon (multipart) : `titre`, `description`, `fichiers`, `images`, `liens` — 5 ressources max. |
| GET | `/salons/{id}/` | Détail : description, ressources, `est_membre`, créateur. |
| PATCH | `/salons/{id}/` | Modifie titre et description (créateur uniquement). |
| DELETE | `/salons/{id}/` | Supprime le salon (créateur uniquement). |
| POST | `/salons/{id}/ressources/` | Ajoute des fichiers, images ou liens au salon (créateur, multipart). |
| POST | `/salons/{id}/join/` | Rejoindre le salon. |
| POST | `/salons/{id}/quit/` | Quitter le salon (non disponible pour le créateur). |
| GET | `/salons/{id}/members/` | Membres du salon. |
| GET | `/salons/{id}/messages/` | Messages ; `?after_id=` pour ne récupérer que les nouveaux (interrogé toutes les 7 s). |
| POST | `/salons/{id}/messages/` | Envoie un message : JSON `contenu`, ou multipart avec `pieces_jointes` si fichiers. |
| GET | `/salons/notifications/` | Notifications non lues (`?unread_only=1`), interrogées toutes les 20 s. |
| POST | `/salons/notifications/mark-read/` | Marque toutes les notifications comme lues. |
| POST | `/salons/notifications/{id}/mark-read/` | Marque une notification comme lue (à son ouverture). |

## Statistiques — `lib/data/services/stats_service.dart`

| Méthode | Endpoint | Commentaire |
|---|---|---|
| GET | `/ressources/statistiques-actions/` | Ajouts et modifications de ressources (administrateurs) : `group_by=utilisateur_date`, `date_debut`, `date_fin`. Les exports PDF/Excel sont générés sur l'appareil. |

## HAL (ressources externes) — `lib/data/services/hal_service.dart`

| Méthode | Endpoint | Commentaire |
|---|---|---|
| GET | `/api/hal/meta/` | Filtres par défaut proposés par le serveur (ex. dépôts avec fichier). |
| GET | `/api/hal/ouvrages/` | Recherche paginée (10 par page) : `q`, `title`, `author`, `keywords`, `year`, `domain`, `language`, `doc_type`, `has_file`, `page`, `page_size`. Avec `page_size=1`, sert au compteur de l'accueil. |
| GET | `/api/hal/ouvrages/{identifiant}/` | Notice complète d'un ouvrage, rechargée à l'ouverture de la fiche. |
| GET | `/api/hal/domaines/` | Domaines HAL pour le filtre : `language`, `doc_type`, `limit=100`. |

## Fichiers et médias — `lib/data/services/file_service.dart`

| Méthode | Endpoint | Commentaire |
|---|---|---|
| GET | `{serveur}/media/...` | Couvertures, avatars, pièces jointes et documents. PDF et EPUB sont chargés en mémoire avec le jeton (nouvel essai sans jeton si refus), jamais enregistrés sur l'appareil. |
| GET | URL externe HAL (`document_url`) | PDF HAL affiché dans le lecteur intégré ; bouton « Ouvrir dans le navigateur » en cas d'échec. |
