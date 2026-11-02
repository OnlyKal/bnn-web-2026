/// Convertit un fragment HTML (description d'une ressource) en texte lisible,
/// en conservant les retours à la ligne des paragraphes et listes.
String htmlToPlainText(String? html) {
  if (html == null || html.trim().isEmpty) return '';
  var text = html
      .replaceAll(RegExp(r'<(script|style)[^>]*>[\s\S]*?</\1>', caseSensitive: false), '')
      .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'<li[^>]*>', caseSensitive: false), '\n• ')
      .replaceAll(
        RegExp(r'</(p|div|h[1-6]|li|ul|ol|blockquote|tr)>', caseSensitive: false),
        '\n',
      )
      .replaceAll(RegExp(r'<[^>]+>'), '');
  text = decodeHtmlEntities(text);
  return text
      .split('\n')
      .map((line) => line.replaceAll(RegExp(r'[ \t ]+'), ' ').trim())
      .join('\n')
      .replaceAll(RegExp(r'\n{3,}'), '\n\n')
      .trim();
}

const _namedEntities = {
  'amp': '&',
  'lt': '<',
  'gt': '>',
  'quot': '"',
  'apos': "'",
  'nbsp': ' ',
  'eacute': 'é',
  'egrave': 'è',
  'ecirc': 'ê',
  'agrave': 'à',
  'acirc': 'â',
  'ccedil': 'ç',
  'ocirc': 'ô',
  'ucirc': 'û',
  'ugrave': 'ù',
  'icirc': 'î',
  'iuml': 'ï',
  'euml': 'ë',
  'laquo': '«',
  'raquo': '»',
  'rsquo': '’',
  'lsquo': '‘',
  'ldquo': '“',
  'rdquo': '”',
  'hellip': '…',
  'ndash': '–',
  'mdash': '—',
  'copy': '©',
  'deg': '°',
};

String decodeHtmlEntities(String input) {
  return input.replaceAllMapped(RegExp(r'&(#x?[0-9a-fA-F]+|[a-zA-Z]+);'), (m) {
    final entity = m.group(1)!;
    if (entity.startsWith('#')) {
      final isHex = entity.length > 1 && (entity[1] == 'x' || entity[1] == 'X');
      final code = int.tryParse(
        isHex ? entity.substring(2) : entity.substring(1),
        radix: isHex ? 16 : 10,
      );
      return code != null ? String.fromCharCode(code) : m.group(0)!;
    }
    return _namedEntities[entity.toLowerCase()] ?? m.group(0)!;
  });
}
