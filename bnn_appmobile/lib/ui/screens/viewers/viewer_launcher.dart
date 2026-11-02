import 'package:flutter/material.dart';

import '../../../data/models/ressource.dart';
import '../../widgets/external_links.dart';
import 'epub_viewer_screen.dart';
import 'pdf_viewer_screen.dart';
import 'video_viewer_screen.dart';

/// Ouvre un fichier dans le lecteur intégré adapté à son format,
/// ou dans le navigateur pour les autres formats.
Future<void> openFileViewer(
  BuildContext context, {
  required Ressource ressource,
  required RessourceFichier fichier,
}) async {
  final url = fichier.url;
  if (url == null) return;
  final title = fichier.titre ?? ressource.titre;
  final kind = fichier.readableKind(ressource.format);
  final Widget? screen = switch (kind) {
    ReadableKind.pdf => PdfViewerScreen(url: url, title: title, browserUrl: ressource.isExternal ? url : null),
    ReadableKind.epub => EpubViewerScreen(url: url, title: title),
    ReadableKind.video => VideoViewerScreen(url: url, title: title),
    ReadableKind.other => null,
  };
  if (screen == null) {
    await openExternalUrl(context, url);
    return;
  }
  await Navigator.of(context).push(MaterialPageRoute(fullscreenDialog: true, builder: (_) => screen));
}
