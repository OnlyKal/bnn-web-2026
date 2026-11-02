import '../../core/config.dart';
import '../../core/utils/json_utils.dart';

/// Vue typée sur le profil utilisateur renvoyé par l'API (forme variable).
class AppUser {
  AppUser(this.raw);

  final Json raw;

  Json get _source => asJson(raw['user']) ?? asJson(raw['profile']) ?? asJson(raw['profil']) ?? raw;

  String? _field(List<String> keys) => pickString(_source, keys) ?? pickString(raw, keys);

  String? get id => _field(['id', 'user_id', 'pk']);
  String? get username => _field(['username']);
  String? get email => _field(['email']);
  String? get nom => _field(['nom', 'last_name']);
  String? get prenom => _field(['prenom', 'first_name']);
  String? get telephone => _field(['telephone']);
  String? get sexe {
    final value = _field(['sexe']);
    return switch (value?.toLowerCase()) {
      'masculin' || 'm' => 'Masculin',
      'feminin' || 'féminin' || 'f' => 'Féminin',
      _ => value,
    };
  }
  String? get province => _field(['province']);
  String? get matricule => _field(['matricule']);
  String? get universite => _field(['universite']);
  String? get faculte => _field(['faculte']);
  String? get avatarUrl => AppConfig.mediaUrl(_field(['avatar']));
  String? get joinDate => _field(['date_inscription', 'date_joined', 'created_at']);

  String get displayName {
    final full = _field(['full_name', 'name', 'nom_complet']);
    if (full != null) return full;
    final parts = [nom, prenom].whereType<String>().join(' ').trim();
    if (parts.isNotEmpty) return parts;
    return username ?? email ?? 'Utilisateur';
  }

  String get initial => displayName.isNotEmpty ? displayName[0].toUpperCase() : 'U';

  String get handle {
    final name = username;
    if (name != null) return name.startsWith('@') ? name : '@$name';
    return email ?? '';
  }

  /// Valeur brute du rôle (`chercheur`, `etudiant`, `admin`…).
  String get roleValue {
    final role = raw['role'] ?? raw['type_utilisateur'] ?? raw['typeUtilisateur'] ?? raw['profil'];
    if (role is Map) {
      return (pickString(Map<String, dynamic>.from(role), ['nom', 'name', 'libelle', 'label', 'code']) ?? '');
    }
    return role?.toString() ?? '';
  }

  String get roleLabel {
    const labels = {
      'chercheur': 'Chercheur',
      'etudiant': 'Étudiant',
      'professeur': 'Professeur',
      'autres': 'Autres',
      'admin': 'Administrateur',
      'administrateur': 'Administrateur',
    };
    final value = roleValue;
    if (value.isEmpty) return 'Non renseigné';
    return labels[value.toLowerCase()] ?? value;
  }

  bool get isAdmin => ['administrateur', 'admin'].contains(roleValue.toLowerCase());

  /// Identité stable utilisée pour isoler les données locales par compte.
  String get storageIdentity => id ?? email ?? username ?? 'anonymous';

  /// Indique si [person] (auteur d'un message, créateur d'un salon…) est cet utilisateur.
  bool matches(Json? person) {
    if (person == null) return false;
    final pid = pickString(person, ['id', 'user_id', 'pk']);
    if (pid != null && id != null) return pid == id;
    final pUser = pickString(person, ['username']);
    if (pUser != null && username != null && pUser == username) return true;
    final pMail = pickString(person, ['email']);
    return pMail != null && email != null && pMail == email;
  }
}
