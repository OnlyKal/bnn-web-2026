import 'dart:convert';
import 'dart:typed_data';

import 'package:archive/archive.dart';
import 'package:xml/xml.dart';

import '../../core/utils/html_text.dart';

/// Segment de texte enrichi (gras / italique).
class EpubSpan {
  const EpubSpan(this.text, {this.bold = false, this.italic = false});

  final String text;
  final bool bold;
  final bool italic;
}

enum EpubBlockKind { heading, paragraph, listItem, quote, image }

class EpubBlock {
  const EpubBlock(this.kind, {this.spans = const [], this.level = 0, this.imagePath});

  final EpubBlockKind kind;
  final List<EpubSpan> spans;
  final int level;
  final String? imagePath;

  String get plainText => spans.map((s) => s.text).join();
}

class EpubChapter {
  const EpubChapter({required this.title, required this.blocks});

  final String title;
  final List<EpubBlock> blocks;
}

class EpubBook {
  const EpubBook({required this.title, required this.chapters, required this.images});

  final String title;
  final List<EpubChapter> chapters;
  final Map<String, Uint8List> images;
}

class EpubFormatException implements Exception {
  EpubFormatException(this.message);
  final String message;
  @override
  String toString() => message;
}

/// Lecteur EPUB minimal : ZIP → `container.xml` → OPF (manifest + spine) → XHTML.
class EpubParser {
  EpubParser._();

  /// Point d'entrée compatible avec `compute()`.
  static EpubBook parse(Uint8List bytes) {
    final Archive archive;
    try {
      archive = ZipDecoder().decodeBytes(bytes);
    } catch (_) {
      throw EpubFormatException("Le fichier n'est pas un EPUB valide.");
    }
    final files = <String, ArchiveFile>{for (final f in archive.files) if (f.isFile) f.name: f};

    String? readText(String path) {
      final file = files[path];
      if (file == null) return null;
      return utf8.decode(file.content as List<int>, allowMalformed: true);
    }

    final container = readText('META-INF/container.xml');
    if (container == null) throw EpubFormatException('EPUB invalide : container.xml manquant.');
    final opfPath = _parseXml(container)
        .findAllElements('rootfile')
        .map((e) => e.getAttribute('full-path'))
        .whereType<String>()
        .firstOrNull;
    final opfText = opfPath == null ? null : readText(opfPath);
    if (opfPath == null || opfText == null) throw EpubFormatException('EPUB invalide : fichier OPF manquant.');

    final opfDir = _dirname(opfPath);
    final opf = _parseXml(opfText);
    final title = opf.findAllElements('title', namespace: '*').map((e) => e.innerText.trim()).firstOrNull ?? '';

    final manifest = <String, ({String href, String type, String props})>{};
    for (final item in opf.findAllElements('item', namespace: '*')) {
      final id = item.getAttribute('id');
      final href = item.getAttribute('href');
      if (id == null || href == null) continue;
      manifest[id] = (
        href: _resolve(opfDir, Uri.decodeFull(href)),
        type: item.getAttribute('media-type') ?? '',
        props: item.getAttribute('properties') ?? '',
      );
    }

    final tocTitles = _tocTitles(manifest, opf, readText);

    final images = <String, Uint8List>{};
    for (final entry in manifest.values) {
      if (entry.type.startsWith('image/') && files[entry.href] != null) {
        images[entry.href] = Uint8List.fromList(files[entry.href]!.content as List<int>);
      }
    }

    final chapters = <EpubChapter>[];
    for (final ref in opf.findAllElements('itemref', namespace: '*')) {
      final item = manifest[ref.getAttribute('idref')];
      if (item == null || !(item.type.contains('html') || item.href.endsWith('html'))) continue;
      final content = readText(item.href);
      if (content == null) continue;
      final blocks = _parseChapter(content, _dirname(item.href));
      if (blocks.isEmpty) continue;
      final heading = blocks.where((b) => b.kind == EpubBlockKind.heading).map((b) => b.plainText).firstOrNull;
      chapters.add(EpubChapter(
        title: tocTitles[item.href] ?? heading ?? 'Chapitre ${chapters.length + 1}',
        blocks: blocks,
      ));
    }
    if (chapters.isEmpty) throw EpubFormatException('Ce livre ne contient aucun chapitre lisible.');
    return EpubBook(title: title, chapters: chapters, images: images);
  }

  static Map<String, String> _tocTitles(
    Map<String, ({String href, String type, String props})> manifest,
    XmlDocument opf,
    String? Function(String) readText,
  ) {
    final titles = <String, String>{};
    // EPUB 3 : document de navigation.
    final nav = manifest.values.where((m) => m.props.contains('nav')).firstOrNull;
    if (nav != null) {
      final text = readText(nav.href);
      if (text != null) {
        try {
          for (final a in _parseXml(text).findAllElements('a', namespace: '*')) {
            final href = a.getAttribute('href');
            final label = a.innerText.trim();
            if (href == null || label.isEmpty) continue;
            titles.putIfAbsent(_resolve(_dirname(nav.href), Uri.decodeFull(href.split('#').first)), () => label);
          }
        } catch (_) {}
      }
    }
    // EPUB 2 : toc.ncx.
    final ncx = manifest.values.where((m) => m.type == 'application/x-dtbncx+xml').firstOrNull;
    if (ncx != null) {
      final text = readText(ncx.href);
      if (text != null) {
        try {
          for (final point in _parseXml(text).findAllElements('navPoint', namespace: '*')) {
            final label = point.findElements('navLabel', namespace: '*').firstOrNull?.innerText.trim();
            final src = point.findElements('content', namespace: '*').firstOrNull?.getAttribute('src');
            if (label == null || label.isEmpty || src == null) continue;
            titles.putIfAbsent(_resolve(_dirname(ncx.href), Uri.decodeFull(src.split('#').first)), () => label);
          }
        } catch (_) {}
      }
    }
    return titles;
  }

  static XmlDocument _parseXml(String text) {
    // Les entités HTML (&nbsp;…) ne sont pas déclarées en XML : on les décode d'abord.
    final normalized = text.replaceAllMapped(RegExp(r'&([a-zA-Z][a-zA-Z0-9]*);'), (m) {
      const xmlEntities = {'amp', 'lt', 'gt', 'quot', 'apos'};
      if (xmlEntities.contains(m.group(1))) return m.group(0)!;
      return decodeHtmlEntities(m.group(0)!);
    });
    return XmlDocument.parse(normalized);
  }

  static const _blockTags = {
    'p', 'div', 'section', 'article', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'td', 'dd', 'dt', 'figcaption',
  };

  static List<EpubBlock> _parseChapter(String content, String dir) {
    final XmlDocument doc;
    try {
      doc = _parseXml(content);
    } catch (_) {
      // XHTML invalide : repli sur le texte brut.
      final text = htmlToPlainText(content);
      return text.split(RegExp(r'\n{2,}')).where((p) => p.trim().isNotEmpty)
          .map((p) => EpubBlock(EpubBlockKind.paragraph, spans: [EpubSpan(p.trim())]))
          .toList();
    }
    final body = doc.findAllElements('body', namespace: '*').firstOrNull ?? doc.rootElement;
    final blocks = <EpubBlock>[];
    _walk(body, dir, blocks);
    return blocks;
  }

  static void _walk(XmlElement element, String dir, List<EpubBlock> out) {
    final name = element.name.local.toLowerCase();
    if (name == 'img' || name == 'image') {
      final src = element.getAttribute('src') ??
          element.getAttribute('href', namespace: 'http://www.w3.org/1999/xlink') ??
          element.getAttribute('xlink:href') ??
          element.getAttribute('href');
      if (src != null) {
        out.add(EpubBlock(EpubBlockKind.image, imagePath: _resolve(dir, Uri.decodeFull(src))));
      }
      return;
    }
    final hasBlockChild = element.childElements.any(
      (c) => _blockTags.contains(c.name.local.toLowerCase()) || ['img', 'image', 'svg', 'ul', 'ol', 'table'].contains(c.name.local.toLowerCase()),
    );
    if (_blockTags.contains(name) && !hasBlockChild) {
      final spans = <EpubSpan>[];
      _collectSpans(element, spans, bold: false, italic: false);
      final text = spans.map((s) => s.text).join().trim();
      if (text.isEmpty) return;
      final kind = switch (name) {
        'h1' || 'h2' || 'h3' || 'h4' || 'h5' || 'h6' => EpubBlockKind.heading,
        'li' => EpubBlockKind.listItem,
        'blockquote' => EpubBlockKind.quote,
        _ => EpubBlockKind.paragraph,
      };
      final level = kind == EpubBlockKind.heading ? int.parse(name.substring(1)) : 0;
      out.add(EpubBlock(kind, spans: _trimSpans(spans), level: level));
      return;
    }
    // Conteneur : texte libre éventuel puis enfants.
    final looseText = element.children.whereType<XmlText>().map((t) => t.value).join().trim();
    if (looseText.isNotEmpty && !hasBlockChild) {
      out.add(EpubBlock(EpubBlockKind.paragraph, spans: [EpubSpan(looseText.replaceAll(RegExp(r'\s+'), ' '))]));
    }
    for (final child in element.childElements) {
      _walk(child, dir, out);
    }
  }

  static void _collectSpans(XmlNode node, List<EpubSpan> out, {required bool bold, required bool italic}) {
    for (final child in node.children) {
      if (child is XmlText || child is XmlCDATA) {
        final text = child.value?.replaceAll(RegExp(r'\s+'), ' ') ?? '';
        if (text.isNotEmpty) out.add(EpubSpan(text, bold: bold, italic: italic));
      } else if (child is XmlElement) {
        final tag = child.name.local.toLowerCase();
        if (tag == 'br') {
          out.add(const EpubSpan('\n'));
          continue;
        }
        _collectSpans(
          child,
          out,
          bold: bold || tag == 'b' || tag == 'strong',
          italic: italic || tag == 'i' || tag == 'em',
        );
      }
    }
  }

  static List<EpubSpan> _trimSpans(List<EpubSpan> spans) {
    if (spans.isEmpty) return spans;
    final result = [...spans];
    final first = result.first;
    result[0] = EpubSpan(first.text.trimLeft(), bold: first.bold, italic: first.italic);
    final last = result.last;
    result[result.length - 1] = EpubSpan(last.text.trimRight(), bold: last.bold, italic: last.italic);
    return result;
  }

  static String _dirname(String path) {
    final index = path.lastIndexOf('/');
    return index < 0 ? '' : path.substring(0, index);
  }

  static String _resolve(String dir, String href) {
    if (href.startsWith('/')) return href.substring(1);
    final parts = <String>[if (dir.isNotEmpty) ...dir.split('/')];
    for (final segment in href.split('/')) {
      if (segment == '..') {
        if (parts.isNotEmpty) parts.removeLast();
      } else if (segment != '.' && segment.isNotEmpty) {
        parts.add(segment);
      }
    }
    return parts.join('/');
  }
}
