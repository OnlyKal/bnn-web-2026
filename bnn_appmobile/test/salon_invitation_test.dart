import 'package:bnn_appmobile/data/services/salons_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group("Lien d'invitation des salons", () {
    test('extrait le jeton du lien généré par le serveur', () {
      expect(
        SalonsService.invitationTokenFrom('https://bnn.minesursi.gouv.cd/salons?invitation=eyJzIjoxfQ%3A1x%3Aabc'),
        'eyJzIjoxfQ:1x:abc',
      );
    });

    test('accepte le jeton seul, avec des espaces autour', () {
      expect(SalonsService.invitationTokenFrom('  eyJzIjoxfQ:1x:abc \n'), 'eyJzIjoxfQ:1x:abc');
    });

    test('refuse un lien sans invitation ou un texte vide', () {
      expect(SalonsService.invitationTokenFrom('https://bnn.minesursi.gouv.cd/salons'), isNull);
      expect(SalonsService.invitationTokenFrom('bonjour à tous'), isNull);
      expect(SalonsService.invitationTokenFrom('   '), isNull);
    });
  });
}
