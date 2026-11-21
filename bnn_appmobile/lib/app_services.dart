import 'core/network/api_client.dart';
import 'core/storage/session_storage.dart';
import 'data/services/auth_service.dart';
import 'data/services/consultations_service.dart';
import 'data/services/encyclopedie_service.dart';
import 'data/services/favoris_service.dart';
import 'data/services/file_service.dart';
import 'data/services/hal_service.dart';
import 'data/services/openalex_service.dart';
import 'data/services/ressources_service.dart';
import 'data/services/salons_service.dart';
import 'data/services/stats_service.dart';
import 'data/services/user_service.dart';

typedef ServiceBuilder<T> = T Function(ApiClient client);

/// Conteneur des services partagés, injecté via `Provider`.
///
/// Chaque service peut être remplacé (tests) en passant un constructeur dédié.
class AppServices {
  AppServices._({
    required this.session,
    required this.client,
    required this.auth,
    required this.users,
    required this.favoris,
    required this.ressources,
    required this.hal,
    required this.openAlex,
    required this.files,
    required this.salons,
    required this.stats,
    required this.encyclopedie,
    required this.consultations,
  });

  factory AppServices.create({
    SessionStorage? session,
    ServiceBuilder<AuthService>? auth,
    ServiceBuilder<UserService>? users,
    ServiceBuilder<FavorisService>? favoris,
    ServiceBuilder<RessourcesService>? ressources,
    HalService? hal,
    OpenAlexService? openAlex,
    ServiceBuilder<SalonsService>? salons,
    ServiceBuilder<StatsService>? stats,
    EncyclopedieService? encyclopedie,
    ConsultationsService? consultations,
  }) {
    final storage = session ?? SessionStorage();
    final client = ApiClient(storage);
    return AppServices._(
      session: storage,
      client: client,
      auth: (auth ?? AuthService.new)(client),
      users: (users ?? UserService.new)(client),
      favoris: (favoris ?? FavorisService.new)(client),
      ressources: (ressources ?? RessourcesService.new)(client),
      hal: hal ?? HalService(),
      openAlex: openAlex ?? OpenAlexService(),
      files: FileService(storage),
      salons: (salons ?? SalonsService.new)(client),
      stats: (stats ?? StatsService.new)(client),
      encyclopedie: encyclopedie ?? EncyclopedieService(),
      consultations: consultations ?? ConsultationsService(),
    );
  }

  final SessionStorage session;
  final ApiClient client;
  final AuthService auth;
  final UserService users;
  final FavorisService favoris;
  final RessourcesService ressources;
  final HalService hal;
  final OpenAlexService openAlex;
  final FileService files;
  final SalonsService salons;
  final StatsService stats;
  final EncyclopedieService encyclopedie;
  final ConsultationsService consultations;
}
