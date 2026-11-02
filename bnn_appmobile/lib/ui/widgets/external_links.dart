import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'feedback.dart';

/// Ouvre une URL externe dans le navigateur du système.
Future<void> openExternalUrl(BuildContext context, String? url) async {
  final uri = url == null ? null : Uri.tryParse(url);
  if (uri == null || !(uri.scheme == 'http' || uri.scheme == 'https')) {
    showError(context, 'Lien invalide.');
    return;
  }
  final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) showError(context, "Impossible d'ouvrir le lien.");
}
