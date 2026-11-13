import 'dart:math';

// Nom d'utilisateur généré à l'inscription : nom + 2 premières lettres du prénom + 2 chiffres
// (ex. nom « Justin », prénom « Bihango » → JustinBi02).

const _usernameMaxLength = 20;

const _accents = {
  'à': 'a', 'á': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a', 'å': 'a',
  'ç': 'c',
  'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
  'ñ': 'n',
  'ò': 'o', 'ó': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o',
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
  'ý': 'y', 'ÿ': 'y',
};

// Sans accents ni caractères spéciaux, chaque mot avec une majuscule initiale.
String _usernamePart(String value) {
  final plain = value.toLowerCase().split('').map((c) => _accents[c] ?? c).join();
  return plain
      .split(RegExp('[^a-z0-9]+'))
      .where((word) => word.isNotEmpty)
      .map((word) => word[0].toUpperCase() + word.substring(1))
      .join();
}

String randomUsernameSuffix([Random? random]) =>
    (random ?? Random()).nextInt(100).toString().padLeft(2, '0');

String buildUsername(String nom, String prenom, String suffix) {
  final prefix = _usernamePart(prenom);
  final initials = prefix.length > 2 ? prefix.substring(0, 2) : prefix;
  var base = _usernamePart(nom);
  final room = _usernameMaxLength - initials.length - suffix.length;
  if (base.length > room) base = base.substring(0, room);
  return base.isEmpty ? '' : '$base$initials$suffix';
}
