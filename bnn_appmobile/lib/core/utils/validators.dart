/// Règles de validation identiques à celles de BNN Web (`validators` dans `src/api.js`).
class Validators {
  Validators._();

  static final _email = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
  static final _phone = RegExp(r'^\+243[0-9]{9}$');
  static final _username = RegExp(r'^[a-zA-Z0-9_]{3,20}$');

  static bool isEmail(String value) => _email.hasMatch(value.trim());
  static bool isPhone(String value) => _phone.hasMatch(value.replaceAll(RegExp(r'\s'), ''));
  static bool isUsername(String value) => _username.hasMatch(value.trim());
  static bool isPassword(String value) => value.length >= 8;
  static bool isFilled(String? value) => value != null && value.trim().isNotEmpty;

  static String? required(String? value, String message) =>
      isFilled(value) ? null : message;

  static List<String> passwordChange(String oldPassword, String newPassword, String confirm) {
    final errors = <String>[];
    if (oldPassword.trim().isEmpty) errors.add("L'ancien mot de passe est requis");
    if (newPassword.length < 8) {
      errors.add('Le nouveau mot de passe doit contenir au moins 8 caractères');
    }
    if (newPassword != confirm) errors.add('La confirmation du mot de passe ne correspond pas');
    if (oldPassword.isNotEmpty && oldPassword == newPassword) {
      errors.add("Le nouveau mot de passe doit être différent de l'ancien");
    }
    return errors;
  }
}
