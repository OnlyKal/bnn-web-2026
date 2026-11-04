import 'package:dio/dio.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:pdfx/pdfx.dart';
import 'package:provider/provider.dart';

import '../../../app_services.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/services/file_service.dart';
import 'viewer_scaffold.dart';

class PdfViewerScreen extends StatefulWidget {
  const PdfViewerScreen({super.key, required this.url, required this.title, this.browserUrl, this.loadingLabel});

  final String url;
  final String title;

  /// Message affiché pendant le téléchargement (ex. premier affichage plus long).
  final String? loadingLabel;

  /// URL proposée en repli dans le navigateur (documents externes).
  final String? browserUrl;

  @override
  State<PdfViewerScreen> createState() => _PdfViewerScreenState();
}

class _PdfViewerScreenState extends State<PdfViewerScreen> {
  PdfControllerPinch? _controller;
  final CancelToken _cancel = CancelToken();
  double? _progress;
  String? _error;
  int _page = 1;
  int _pages = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _cancel.cancel();
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _error = null;
      _progress = null;
    });
    try {
      final bytes = await context.read<AppServices>().files.fetch(
            widget.url,
            cancelToken: _cancel,
            onProgress: (p) => mounted ? setState(() => _progress = p) : null,
          );
      if (!FileService.isPdf(bytes)) {
        throw ApiException("Le fichier reçu n'est pas un PDF valide.");
      }
      final controller = PdfControllerPinch(document: PdfDocument.openData(bytes));
      if (!mounted) {
        controller.dispose();
        return;
      }
      setState(() => _controller = controller);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } on DioException {
      // Téléchargement annulé (écran fermé).
    } catch (_) {
      if (mounted) setState(() => _error = "Le document n'a pas pu être affiché.");
    }
  }

  Future<void> _goToPage() async {
    final controller = _controller;
    if (controller == null || _pages <= 1) return;
    final input = TextEditingController(text: '$_page');
    final page = await showDialog<int>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Aller à la page'),
        content: TextField(
          controller: input,
          autofocus: true,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(helperText: 'Entre 1 et $_pages'),
          onSubmitted: (v) => Navigator.of(context).pop(int.tryParse(v)),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Annuler')),
          FilledButton(onPressed: () => Navigator.of(context).pop(int.tryParse(input.text)), child: const Text('Aller')),
        ],
      ),
    );
    input.dispose();
    if (page != null && page >= 1 && page <= _pages) controller.jumpToPage(page);
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    return Scaffold(
      backgroundColor: AppColors.fill,
      appBar: AppBar(
        title: Text(widget.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          if (_pages > 0)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: TextButton.icon(
                style: TextButton.styleFrom(
                  backgroundColor: AppColors.primarySoft,
                  minimumSize: const Size(0, 34),
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                ),
                onPressed: _goToPage,
                icon: const Icon(CupertinoIcons.doc_text, size: 15),
                label: Text('$_page / $_pages'),
              ),
            ),
        ],
      ),
      body: _error != null
          ? ViewerError(message: _error!, onRetry: _load, browserUrl: widget.browserUrl)
          : controller == null
              ? (widget.loadingLabel == null
                  ? ViewerLoading(progress: _progress)
                  : ViewerLoading(progress: _progress, label: widget.loadingLabel!))
              : PdfViewPinch(
                  controller: controller,
                  padding: 8,
                  onDocumentLoaded: (doc) => setState(() => _pages = doc.pagesCount),
                  onPageChanged: (page) => setState(() => _page = page),
                  onDocumentError: (_) =>
                      setState(() => _error = "Le document n'a pas pu être affiché."),
                  builders: PdfViewPinchBuilders<DefaultBuilderOptions>(
                    options: const DefaultBuilderOptions(),
                    documentLoaderBuilder: (_) => const ViewerLoading(progress: null, label: 'Préparation…'),
                    pageLoaderBuilder: (_) => const Center(child: CupertinoActivityIndicator()),
                  ),
                ),
    );
  }
}
