import 'package:cached_network_image/cached_network_image.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../app_services.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/ressource.dart';
import '../../../data/models/salon.dart';
import '../../../data/services/salons_service.dart';
import '../../widgets/common.dart';
import '../../widgets/external_links.dart';
import '../../widgets/feedback.dart';
import '../viewers/epub_viewer_screen.dart';
import '../viewers/pdf_viewer_screen.dart';
import '../viewers/video_viewer_screen.dart';

/// Sélection de fichiers (toutes extensions) depuis l'appareil.
Future<List<PickedUpload>> pickUploads(BuildContext context) async {
  try {
    final result = await FilePicker.pickFiles(allowMultiple: true);
    if (result == null) return const [];
    return result.files
        .where((f) => f.path != null)
        .map((f) => PickedUpload(path: f.path!, name: f.name, size: f.size))
        .toList();
  } catch (_) {
    if (context.mounted) showError(context, "Impossible d'accéder aux fichiers de l'appareil.");
    return const [];
  }
}

/// Ouvre une pièce jointe ou ressource de salon dans le lecteur adapté.
Future<void> openSalonFile(BuildContext context, {required String url, required String name, bool isImage = false}) async {
  if (isImage) {
    await Navigator.of(context).push(MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => _ImageViewer(url: url, title: name),
    ));
    return;
  }
  final kind = RessourceFichier(id: null, titre: name, path: url).readableKind();
  final Widget? screen = switch (kind) {
    ReadableKind.pdf => PdfViewerScreen(url: url, title: name, browserUrl: url),
    ReadableKind.epub => EpubViewerScreen(url: url, title: name),
    ReadableKind.video => VideoViewerScreen(url: url, title: name),
    ReadableKind.other => null,
  };
  if (screen == null) {
    await openExternalUrl(context, url);
  } else {
    await Navigator.of(context).push(MaterialPageRoute(fullscreenDialog: true, builder: (_) => screen));
  }
}

class _ImageViewer extends StatelessWidget {
  const _ImageViewer({required this.url, required this.title});

  final String url;
  final String title;

  @override
  Widget build(BuildContext context) {
    final headers = context.read<AppServices>().files.authHeadersFor(url);
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.white),
        systemOverlayStyle: SystemUiOverlayStyle.light,
        shape: const Border(),
        title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white)),
      ),
      body: InteractiveViewer(
        maxScale: 5,
        child: Center(
          child: CachedNetworkImage(
            imageUrl: url,
            httpHeaders: headers,
            placeholder: (_, _) => const CupertinoActivityIndicator(color: Colors.white),
            errorWidget: (_, _, _) => const Icon(CupertinoIcons.photo, color: Colors.white54, size: 48),
          ),
        ),
      ),
    );
  }
}

/// Tuile d'une ressource partagée dans un salon.
class SalonResourceTile extends StatelessWidget {
  const SalonResourceTile({super.key, required this.resource});

  final SalonResource resource;

  @override
  Widget build(BuildContext context) {
    final (icon, color) = switch (resource.kind) {
      'image' => (CupertinoIcons.photo, AppColors.image),
      'lien' => (CupertinoIcons.link, AppColors.navy),
      _ => (CupertinoIcons.doc_text, AppColors.primary),
    };
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: IconTile(icon, color: color, size: 40, iconSize: 19),
      title: Text(resource.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14.5)),
      subtitle: Text(switch (resource.kind) {
        'image' => 'Image',
        'lien' => 'Lien externe',
        _ => 'Document',
      }),
      trailing: Icon(
        resource.kind == 'lien' ? CupertinoIcons.arrow_up_right_square : CupertinoIcons.chevron_right,
        size: 16,
        color: AppColors.textFaint,
      ),
      onTap: resource.url == null
          ? null
          : () => resource.kind == 'lien'
              ? openExternalUrl(context, resource.url)
              : openSalonFile(context, url: resource.url!, name: resource.title, isImage: resource.kind == 'image'),
    );
  }
}

enum SalonFormMode { create, edit, resources }

class SalonFormResult {
  const SalonFormResult({this.titre = '', this.description = '', this.resources = const SalonResourcesInput()});

  final String titre;
  final String description;
  final SalonResourcesInput resources;
}

/// Feuille de création / modification d'un salon ou d'ajout de ressources.
class SalonFormSheet extends StatefulWidget {
  const SalonFormSheet({super.key, required this.mode, this.initialTitle = '', this.initialDescription = ''});

  final SalonFormMode mode;
  final String initialTitle;
  final String initialDescription;

  @override
  State<SalonFormSheet> createState() => _SalonFormSheetState();
}

class _SalonFormSheetState extends State<SalonFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final _title = TextEditingController(text: widget.initialTitle);
  late final _description = TextEditingController(text: widget.initialDescription);
  final _links = TextEditingController();
  List<PickedUpload> _files = [];

  bool get _withResources => widget.mode != SalonFormMode.edit;
  bool get _withText => widget.mode != SalonFormMode.resources;
  int get _count => _files.length + SalonResourcesInput.splitLinks(_links.text).length;

  @override
  void initState() {
    super.initState();
    _links.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _links.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    if (_withResources) {
      if (_count < 1) {
        showError(context, 'Ajoutez au moins une ressource : fichier, image ou lien.');
        return;
      }
      if (_count > SalonsService.maxResources) {
        showError(context, 'Le salon accepte au maximum ${SalonsService.maxResources} ressources au total.');
        return;
      }
    }
    Navigator.of(context).pop(SalonFormResult(
      titre: _title.text.trim(),
      description: _description.text.trim(),
      resources: SalonResourcesInput(files: _files, links: SalonResourcesInput.splitLinks(_links.text)),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final title = switch (widget.mode) {
      SalonFormMode.create => 'Nouveau salon',
      SalonFormMode.edit => 'Modifier le salon',
      SalonFormMode.resources => 'Ajouter des ressources',
    };
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    IconTile(
                      switch (widget.mode) {
                        SalonFormMode.create => CupertinoIcons.plus_bubble,
                        SalonFormMode.edit => CupertinoIcons.pencil,
                        SalonFormMode.resources => CupertinoIcons.paperclip,
                      },
                      size: 38,
                      iconSize: 19,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(title, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                if (_withText) ...[
                  TextFormField(
                    controller: _title,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(
                      labelText: 'Titre du salon',
                      hintText: 'Ex : Salon recherche',
                      prefixIcon: Icon(CupertinoIcons.textformat, size: 20),
                    ),
                    validator: (v) => (v ?? '').trim().isEmpty ? 'Le titre est requis.' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _description,
                    minLines: 3,
                    maxLines: 6,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(
                      labelText: 'Description',
                      hintText: 'Décrivez le sujet de discussion',
                      alignLabelWithHint: true,
                    ),
                    validator: (v) => (v ?? '').trim().isEmpty ? 'La description est requise.' : null,
                  ),
                  const SizedBox(height: 12),
                ],
                if (_withResources) ...[
                  const Text('Ressources partagées',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () async {
                      final picked = await pickUploads(context);
                      if (picked.isNotEmpty) setState(() => _files = [..._files, ...picked]);
                    },
                    icon: const Icon(CupertinoIcons.paperclip, size: 19),
                    label: const Text('Joindre fichier(s) ou image(s)'),
                  ),
                  for (final (index, f) in _files.indexed)
                    ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: IconTile(f.isImage ? CupertinoIcons.photo : CupertinoIcons.doc_text, size: 34, iconSize: 17),
                      title: Text(f.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                      subtitle: Text(formatFileSize(f.size) ?? ''),
                      trailing: IconButton(
                        tooltip: 'Retirer ${f.name}',
                        icon: const Icon(CupertinoIcons.xmark_circle_fill, color: AppColors.textFaint, size: 20),
                        onPressed: () => setState(() => _files = [..._files]..removeAt(index)),
                      ),
                    ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _links,
                    minLines: 2,
                    maxLines: 4,
                    keyboardType: TextInputType.url,
                    decoration: const InputDecoration(
                      labelText: 'Liens',
                      hintText: 'https://exemple.com (un par ligne)',
                      prefixIcon: Icon(CupertinoIcons.link, size: 20),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '$_count / ${SalonsService.maxResources} ressources',
                    style: TextStyle(
                      color: _count > SalonsService.maxResources ? AppColors.danger : AppColors.textMuted,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                FilledButton(
                  onPressed: _submit,
                  child: Text(switch (widget.mode) {
                    SalonFormMode.create => 'Créer le salon',
                    SalonFormMode.edit => 'Enregistrer',
                    SalonFormMode.resources => 'Ajouter',
                  }),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
