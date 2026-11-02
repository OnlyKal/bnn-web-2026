import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../app_services.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/validators.dart';
import '../../../state/session_controller.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';
import '../auth/auth_scaffold.dart';

const _roles = [
  ('chercheur', 'Chercheur'),
  ('etudiant', 'Étudiant'),
  ('professeur', 'Professeur'),
  ('autres', 'Autres'),
];

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nom;
  late final TextEditingController _prenom;
  late final TextEditingController _telephone;
  late final TextEditingController _email;
  late String _role;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    final user = context.read<SessionController>().user;
    _nom = TextEditingController(text: user?.nom ?? '');
    _prenom = TextEditingController(text: user?.prenom ?? '');
    _telephone = TextEditingController(text: user?.telephone ?? '');
    _email = TextEditingController(text: user?.email ?? '');
    final role = user?.roleValue.toLowerCase() ?? '';
    _role = _roles.any((r) => r.$1 == role) ? role : 'chercheur';
  }

  @override
  void dispose() {
    _nom.dispose();
    _prenom.dispose();
    _telephone.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    final session = context.read<SessionController>();
    final data = {
      'nom': _nom.text.trim(),
      'prenom': _prenom.text.trim(),
      'telephone': _telephone.text.trim(),
      'email': _email.text.trim(),
      'role': _role,
    };
    try {
      final (updated, message) = await context.read<AppServices>().users.updateProfile(data);
      await session.updateUser(updated ?? {...?session.user?.raw, ...data});
      if (!mounted) return;
      showSuccess(context, message ?? 'Profil mis à jour avec succès !');
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Modifier le profil')),
      body: Form(
        key: _formKey,
        child: ListView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
          children: [
            const _FormLabel('Identité'),
            SurfaceCard(
              padding: const EdgeInsets.fromLTRB(14, 16, 14, 2),
              child: Column(
                children: [
                  TextFormField(
                    controller: _nom,
                    enabled: !_loading,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(labelText: 'Nom', prefixIcon: Icon(CupertinoIcons.person, size: 20)),
                    validator: (v) => Validators.required(v, 'Le nom est requis'),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _prenom,
                    enabled: !_loading,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(labelText: 'Prénom', prefixIcon: Icon(CupertinoIcons.person, size: 20)),
                    validator: (v) => Validators.required(v, 'Le prénom est requis'),
                  ),
                  const SizedBox(height: 14),
                ],
              ),
            ),
            const SizedBox(height: 14),
            const _FormLabel('Coordonnées'),
            SurfaceCard(
              padding: const EdgeInsets.fromLTRB(14, 16, 14, 2),
              child: Column(
                children: [
                  TextFormField(
                    controller: _telephone,
                    enabled: !_loading,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Téléphone',
                      helperText: '+243 suivi de 9 chiffres',
                      prefixIcon: Icon(CupertinoIcons.phone, size: 20),
                    ),
                    validator: (v) => (v ?? '').trim().isEmpty || Validators.isPhone(v!)
                        ? null
                        : 'Le téléphone doit commencer par +243 suivi de 9 chiffres',
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _email,
                    enabled: !_loading,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(CupertinoIcons.envelope, size: 20)),
                    validator: (v) => Validators.isEmail(v ?? '') ? null : "Format d'email invalide",
                  ),
                  const SizedBox(height: 14),
                ],
              ),
            ),
            const SizedBox(height: 14),
            const _FormLabel('Rôle'),
            SurfaceCard(
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final (value, label) in _roles)
                    ChoiceChip(
                      label: Text(label),
                      selected: _role == value,
                      onSelected: _loading ? null : (_) => setState(() => _role = value),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 28),
            LoadingButton(
              label: 'Enregistrer',
              loadingLabel: 'Enregistrement…',
              icon: CupertinoIcons.checkmark_alt,
              loading: _loading,
              onPressed: _save,
            ),
          ],
        ),
      ),
    );
  }
}

class _FormLabel extends StatelessWidget {
  const _FormLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 4, 8),
      child: Text(
        text.toUpperCase(),
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 0.6, color: AppColors.textMuted),
      ),
    );
  }
}
