import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../data/models/encyclopedie.dart';
import '../../widgets/common.dart';
import '../../widgets/external_links.dart';
import '../viewers/pdf_viewer_screen.dart';
import '../viewers/video_viewer_screen.dart';
import 'rdc_widgets.dart';

final _videoFile = RegExp(r'\.(mp4|webm|mov|m4v)(\?.*)?$', caseSensitive: false);
final _pdfFile = RegExp(r'\.pdf(\?.*)?$', caseSensitive: false);

/// Ouvre un média dans le lecteur intégré adapté, sinon dans le navigateur.
Future<void> openRdcMedia(BuildContext context, RdcMedia media) async {
  final url = media.url;
  if (url == null) return;
  final title = media.titre.isEmpty ? media.typeLabel : media.titre;
  Widget? screen;
  if (media.type == 'video' && _videoFile.hasMatch(url)) {
    screen = VideoViewerScreen(url: url, title: title);
  } else if (media.type == 'document' && _pdfFile.hasMatch(url)) {
    screen = PdfViewerScreen(url: url, title: title, browserUrl: url);
  }
  if (screen == null) {
    await openExternalUrl(context, url);
    return;
  }
  await Navigator.of(context).push(MaterialPageRoute(fullscreenDialog: true, builder: (_) => screen!));
}

/// Galerie : visuels en vignettes (visionneuse plein écran), puis vidéos, audio et documents.
class RdcMediaGallery extends StatelessWidget {
  const RdcMediaGallery({super.key, required this.medias});

  final List<RdcMedia> medias;

  @override
  Widget build(BuildContext context) {
    final visuals = medias.where((m) => m.isVisual && m.url != null).toList();
    final others = medias.where((m) => !m.isVisual && m.url != null).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (visuals.isNotEmpty)
          SizedBox(
            height: 132,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: visuals.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (context, i) {
                final media = visuals[i];
                return Semantics(
                  button: true,
                  label: media.titre.isEmpty ? media.typeLabel : media.titre,
                  child: GestureDetector(
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      fullscreenDialog: true,
                      builder: (_) => RdcPhotoViewer(medias: visuals, initialIndex: i),
                    )),
                    child: Stack(
                      children: [
                        NetworkCover(url: media.vignette ?? media.url, width: 170, height: 132, fallbackIcon: CupertinoIcons.photo),
                        Positioned(
                          left: 6,
                          top: 6,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(color: AppColors.ink.withValues(alpha: 0.7), borderRadius: BorderRadius.circular(6)),
                            child: Text(media.typeLabel, style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w700)),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        if (others.isNotEmpty)
          Padding(
            padding: EdgeInsets.fromLTRB(16, visuals.isEmpty ? 0 : 12, 16, 0),
            child: Column(
              children: [
                for (final media in others)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: SurfaceCard(
                      onTap: () => openRdcMedia(context, media),
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        children: [
                          Icon(
                            switch (media.type) {
                              'video' => CupertinoIcons.play_rectangle,
                              'audio' => CupertinoIcons.headphones,
                              _ => CupertinoIcons.doc_text,
                            },
                            color: media.type == 'document' ? AppColors.pdf : AppColors.video,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(media.titre.isEmpty ? media.typeLabel : media.titre,
                                    style: const TextStyle(fontWeight: FontWeight.w700)),
                                if (media.legende.isNotEmpty)
                                  Text(media.legende, maxLines: 2, overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(color: AppColors.textMuted, fontSize: 12.5)),
                              ],
                            ),
                          ),
                          const Icon(CupertinoIcons.chevron_right, size: 16, color: AppColors.textFaint),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

/// Visionneuse plein écran (glisser entre les images, pincer pour zoomer).
class RdcPhotoViewer extends StatefulWidget {
  const RdcPhotoViewer({super.key, required this.medias, this.initialIndex = 0});

  final List<RdcMedia> medias;
  final int initialIndex;

  @override
  State<RdcPhotoViewer> createState() => _RdcPhotoViewerState();
}

class _RdcPhotoViewerState extends State<RdcPhotoViewer> {
  late final PageController _controller = PageController(initialPage: widget.initialIndex);
  late int _index = widget.initialIndex;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final media = widget.medias[_index];
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text('${_index + 1} / ${widget.medias.length}'),
      ),
      body: Column(
        children: [
          Expanded(
            child: PageView.builder(
              controller: _controller,
              itemCount: widget.medias.length,
              onPageChanged: (i) => setState(() => _index = i),
              itemBuilder: (_, i) => InteractiveViewer(
                maxScale: 5,
                child: Center(
                  child: NetworkCover(url: widget.medias[i].url, radius: 0, fit: BoxFit.contain, fallbackIcon: CupertinoIcons.photo),
                ),
              ),
            ),
          ),
          if (media.titre.isNotEmpty || media.legende.isNotEmpty || media.credit.isNotEmpty)
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (media.titre.isNotEmpty)
                      Text(media.titre, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
                    if (media.legende.isNotEmpty)
                      Text(media.legende, style: const TextStyle(color: Colors.white70, height: 1.4)),
                    if (media.credit.isNotEmpty)
                      Text('© ${media.credit}', style: const TextStyle(color: Colors.white54, fontSize: 12)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Liste des sources et références.
class RdcSourcesList extends StatelessWidget {
  const RdcSourcesList({super.key, required this.sources});

  final List<RdcSource> sources;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Column(
          children: [
            for (final (i, source) in sources.indexed)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(width: 22, child: Text('${i + 1}.', style: const TextStyle(color: AppColors.textMuted))),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (source.typeLabel.isNotEmpty) Pill(source.typeLabel),
                          const SizedBox(height: 4),
                          Text(source.citation, style: const TextStyle(height: 1.4, color: AppColors.textSecondary)),
                          if (source.url.isNotEmpty)
                            InkWell(
                              onTap: () => openExternalUrl(context, source.url),
                              child: const Padding(
                                padding: EdgeInsets.symmetric(vertical: 4),
                                child: Text('Consulter la source',
                                    style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700)),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      );
}

/// Tableau « libellé : valeur » (fiche technique, données statistiques).
class RdcFactsCard extends StatelessWidget {
  const RdcFactsCard({super.key, required this.rows});

  final List<MapEntry<String, String>> rows;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: SurfaceCard(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          child: Column(
            children: [
              for (final (i, row) in rows.indexed)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    border: i == rows.length - 1 ? null : const Border(bottom: BorderSide(color: AppColors.divider)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        flex: 4,
                        child: Text(row.key, style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        flex: 6,
                        child: Text(row.value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      );
}

String rdcPlural(int n, String word) => '${rdcNumber(n)} $word${n > 1 ? 's' : ''}';
