import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../app_services.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../widgets/common.dart';
import '../../../data/epub/epub_parser.dart';
import '../../../data/services/file_service.dart';
import 'viewer_scaffold.dart';

class EpubViewerScreen extends StatefulWidget {
  const EpubViewerScreen({super.key, required this.url, required this.title});

  final String url;
  final String title;

  @override
  State<EpubViewerScreen> createState() => _EpubViewerScreenState();
}

class _EpubViewerScreenState extends State<EpubViewerScreen> {
  final CancelToken _cancel = CancelToken();
  final ScrollController _scroll = ScrollController();
  EpubBook? _book;
  double? _progress;
  String? _error;
  bool _parsing = false;
  int _chapter = 0;
  double _fontSize = 17;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _cancel.cancel();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _error = null;
      _progress = null;
      _parsing = false;
    });
    try {
      final bytes = await context.read<AppServices>().files.fetch(
            widget.url,
            cancelToken: _cancel,
            onProgress: (p) => mounted ? setState(() => _progress = p) : null,
          );
      if (!FileService.isZip(bytes)) {
        throw ApiException("Le fichier téléchargé n'est pas un EPUB valide.");
      }
      if (mounted) setState(() => _parsing = true);
      final book = await compute(EpubParser.parse, bytes);
      if (mounted) setState(() => _book = book);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } on EpubFormatException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } on DioException {
      // Téléchargement annulé.
    } catch (_) {
      if (mounted) setState(() => _error = 'Impossible de charger le fichier EPUB.');
    }
  }

  void _goTo(int chapter) {
    final book = _book;
    if (book == null || chapter < 0 || chapter >= book.chapters.length) return;
    setState(() => _chapter = chapter);
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  Future<void> _showToc() async {
    final book = _book!;
    final selected = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        builder: (context, scroll) => Column(
          children: [
            SheetHeader(
              title: 'Table des matières',
              subtitle: '${book.chapters.length} chapitre(s)',
              icon: CupertinoIcons.list_bullet,
            ),
            const Divider(),
            Expanded(
              child: ListView.builder(
                controller: scroll,
                itemCount: book.chapters.length,
                itemBuilder: (context, index) => ListTile(
                  selected: index == _chapter,
                  selectedTileColor: AppColors.primarySoft,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 20),
                  leading: Text('${index + 1}', style: const TextStyle(color: AppColors.textMuted, fontWeight: FontWeight.w600)),
                  trailing: index == _chapter ? const Icon(CupertinoIcons.bookmark_fill, size: 16, color: AppColors.primary) : null,
                  title: Text(book.chapters[index].title, maxLines: 2, overflow: TextOverflow.ellipsis),
                  onTap: () => Navigator.of(context).pop(index),
                ),
              ),
            ),
          ],
        ),
      ),
    );
    if (selected != null) _goTo(selected);
  }

  Widget _block(EpubBlock block, EpubBook book) {
    if (block.kind == EpubBlockKind.image) {
      final bytes = book.images[block.imagePath];
      if (bytes == null) return const SizedBox.shrink();
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Center(child: Image.memory(bytes, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox.shrink())),
      );
    }
    final base = TextStyle(fontSize: _fontSize, height: 1.6, color: AppColors.textPrimary);
    final style = switch (block.kind) {
      EpubBlockKind.heading => base.copyWith(
          fontSize: _fontSize + (block.level <= 1 ? 8 : block.level == 2 ? 5 : 2),
          fontWeight: FontWeight.w800,
          height: 1.3,
        ),
      EpubBlockKind.quote => base.copyWith(fontStyle: FontStyle.italic, color: AppColors.textSecondary),
      _ => base,
    };
    final text = Text.rich(
      TextSpan(
        style: style,
        children: [
          if (block.kind == EpubBlockKind.listItem) const TextSpan(text: '•  '),
          for (final s in block.spans)
            TextSpan(
              text: s.text,
              style: TextStyle(
                fontWeight: s.bold ? FontWeight.w700 : null,
                fontStyle: s.italic ? FontStyle.italic : null,
              ),
            ),
        ],
      ),
      textAlign: block.kind == EpubBlockKind.paragraph ? TextAlign.justify : TextAlign.start,
    );
    return Padding(
      padding: EdgeInsets.only(
        top: block.kind == EpubBlockKind.heading ? 18 : 0,
        bottom: 12,
        left: block.kind == EpubBlockKind.quote || block.kind == EpubBlockKind.listItem ? 14 : 0,
      ),
      child: block.kind == EpubBlockKind.quote
          ? DecoratedBox(
              decoration: const BoxDecoration(border: Border(left: BorderSide(color: AppColors.primary, width: 3))),
              child: Padding(padding: const EdgeInsets.only(left: 12), child: text),
            )
          : text,
    );
  }

  @override
  Widget build(BuildContext context) {
    final book = _book;
    return Scaffold(
      backgroundColor: const Color(0xFFFFFDF8),
      appBar: AppBar(
        title: Text(widget.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: book == null
            ? null
            : [
                IconButton(
                  tooltip: 'Réduire le texte',
                  onPressed: _fontSize > 13 ? () => setState(() => _fontSize -= 1) : null,
                  icon: const Icon(CupertinoIcons.textformat_size, size: 17),
                ),
                IconButton(
                  tooltip: 'Agrandir le texte',
                  onPressed: _fontSize < 26 ? () => setState(() => _fontSize += 1) : null,
                  icon: const Icon(CupertinoIcons.textformat_size, size: 23),
                ),
                IconButton(tooltip: 'Table des matières', onPressed: _showToc, icon: const Icon(CupertinoIcons.list_bullet)),
              ],
      ),
      body: _error != null
          ? ViewerError(message: _error!, onRetry: _load)
          : book == null
              ? ViewerLoading(
                  progress: _parsing ? null : _progress,
                  label: _parsing ? 'Préparation du livre…' : 'Chargement du livre…',
                )
              : SafeArea(
                  child: Column(
                    children: [
                      LinearProgressIndicator(
                        value: (_chapter + 1) / book.chapters.length,
                        minHeight: 3,
                        backgroundColor: AppColors.primaryTint,
                      ),
                      Expanded(
                        child: Scrollbar(
                          controller: _scroll,
                          child: ListView.builder(
                            controller: _scroll,
                            padding: const EdgeInsets.fromLTRB(22, 20, 22, 40),
                            itemCount: book.chapters[_chapter].blocks.length,
                            itemBuilder: (context, index) => _block(book.chapters[_chapter].blocks[index], book),
                          ),
                        ),
                      ),
                      _ChapterBar(
                        index: _chapter,
                        count: book.chapters.length,
                        title: book.chapters[_chapter].title,
                        onPrevious: () => _goTo(_chapter - 1),
                        onNext: () => _goTo(_chapter + 1),
                        onToc: _showToc,
                      ),
                    ],
                  ),
                ),
    );
  }
}

class _ChapterBar extends StatelessWidget {
  const _ChapterBar({
    required this.index,
    required this.count,
    required this.title,
    required this.onPrevious,
    required this.onNext,
    required this.onToc,
  });

  final int index;
  final int count;
  final String title;
  final VoidCallback onPrevious;
  final VoidCallback onNext;
  final VoidCallback onToc;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Chapitre précédent',
            onPressed: index > 0 ? onPrevious : null,
            icon: const Icon(CupertinoIcons.chevron_left),
          ),
          Expanded(
            child: InkWell(
              onTap: onToc,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Column(
                  children: [
                    Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                    Text('Chapitre ${index + 1} sur $count', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                  ],
                ),
              ),
            ),
          ),
          IconButton(
            tooltip: 'Chapitre suivant',
            onPressed: index < count - 1 ? onNext : null,
            icon: const Icon(CupertinoIcons.chevron_right),
          ),
        ],
      ),
    );
  }
}
