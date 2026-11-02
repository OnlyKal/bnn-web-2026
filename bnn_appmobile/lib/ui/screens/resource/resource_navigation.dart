import 'package:flutter/material.dart';

import '../../../data/models/ressource.dart';
import 'resource_details_screen.dart';

/// Ouvre la fiche détaillée d'une ressource (interne ou HAL).
Future<void> openRessourceDetails(BuildContext context, Ressource ressource, {String? description}) {
  return Navigator.of(context).push(
    MaterialPageRoute(
      builder: (_) => ResourceDetailsScreen(initial: ressource, historyDescription: description),
    ),
  );
}

/// Ouvre une ressource interne connue uniquement par son identifiant.
Future<void> openRessourceById(BuildContext context, String id) {
  return Navigator.of(context).push(
    MaterialPageRoute(builder: (_) => ResourceDetailsScreen(resourceId: id)),
  );
}
