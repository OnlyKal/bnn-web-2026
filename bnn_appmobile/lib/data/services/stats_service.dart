import 'package:dio/dio.dart';

import '../../core/network/api_client.dart';
import '../../core/network/api_exception.dart';
import '../models/action_stats.dart';

class StatsService {
  StatsService(this._client);

  final ApiClient _client;

  Future<List<ActionRow>> actions({required String dateDebut, required String dateFin, CancelToken? cancelToken}) async {
    try {
      final response = await _client.dio.get<dynamic>(
        '/ressources/statistiques-actions/',
        queryParameters: {'group_by': 'utilisateur_date', 'date_debut': dateDebut, 'date_fin': dateFin},
        cancelToken: cancelToken,
      );
      return ActionStatsParser.parse(response.data);
    } catch (e) {
      throw ApiException.from(e, fallback: 'Erreur lors du chargement des statistiques');
    }
  }
}
