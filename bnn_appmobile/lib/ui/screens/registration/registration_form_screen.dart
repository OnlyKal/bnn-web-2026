import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../app_services.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/json_utils.dart';
import '../../../core/utils/username.dart';
import '../../../core/utils/validators.dart';
import '../../../data/models/registration.dart';
import '../../../data/services/auth_service.dart';
import '../../../state/session_controller.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';
import '../auth/auth_scaffold.dart';
import 'registration_scaffold.dart';

class RegistrationFormScreen extends StatefulWidget {
  const RegistrationFormScreen({super.key, required this.selection});

  final RegistrationSelection selection;

  @override
  State<RegistrationFormScreen> createState() => _RegistrationFormScreenState();
}

class _RegistrationFormScreenState extends State<RegistrationFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  final _nom = TextEditingController();
  final _prenom = TextEditingController();
  final _telephone = TextEditingController(text: '+243');
  final _faculte = TextEditingController();
  final _usernameField = TextEditingController();
  String _usernameSuffix = randomUsernameSuffix();
  String? _sexe;
  DateTime? _birthDate;
  bool _obscure = true;
  bool _loading = false;
  bool _submitted = false;

  bool get _isStudent => widget.selection.userType?.value == 'etudiant';

  String get _username => buildUsername(_nom.text, _prenom.text, _usernameSuffix);

  @override
  void initState() {
    super.initState();
    _nom.addListener(_syncUsername);
    _prenom.addListener(_syncUsername);
  }

  void _syncUsername() {
    final username = _username;
    if (_usernameField.text != username) setState(() => _usernameField.text = username);
  }

  void _regenerateUsername() {
    _usernameSuffix = randomUsernameSuffix();
    _syncUsername();
  }

  @override
  void dispose() {
    for (final c in [_email, _password, _confirm, _nom, _prenom, _telephone, _faculte, _usernameField]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _birthDate ?? DateTime(now.year - 20),
      firstDate: DateTime(1920),
      lastDate: now,
      helpText: 'Date de naissance',
      initialEntryMode: DatePickerEntryMode.calendarOnly,
    );
    if (picked != null) setState(() => _birthDate = picked);
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() => _submitted = true);
    final valid = _formKey.currentState!.validate();
    if (!valid || _sexe == null || _birthDate == null) {
      showError(context, 'Veuillez corriger les champs signalés.');
      return;
    }
    if (!Validators.isUsername(_username)) {
      showError(context, "Le nom doit contenir des lettres pour générer le nom d'utilisateur.");
      return;
    }
    final selection = widget.selection;
    setState(() => _loading = true);
    final services = context.read<AppServices>();
    final session = context.read<SessionController>();
    try {
      final response = await services.auth.register(
        RegistrationData(
          username: _username,
          nom: _nom.text,
          prenom: _prenom.text,
          password: _password.text,
          role: selection.userType!.value,
          sexe: _sexe!,
          telephone: _telephone.text.replaceAll(' ', ''),
          email: _email.text,
          faculte: _faculte.text,
          universite: selection.universite!.nom,
          dateNaissance: _birthDate!,
        ),
      );
      if (!mounted) return;
      final token = pickString(response, ['token']);
      if (token != null) {
        showSuccess(context, 'Compte créé avec succès ! Bienvenue sur la BNN.');
        await session.startSession(token, asJson(response['user']) ?? asJson(response['data']));
      } else {
        showSuccess(context, 'Compte créé avec succès ! Veuillez vous connecter.');
        Navigator.of(context).popUntil((route) => route.isFirst);
      }
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateLabel = _birthDate == null
        ? 'Sélectionner une date'
        : DateFormat('d MMMM y', 'fr_FR').format(_birthDate!);

    return RegistrationScaffold(
      step: 4,
      title: 'Vos informations',
      subtitle: 'Tous les champs marqués d’un astérisque (*) sont obligatoires.',
      selection: widget.selection,
      body: Form(
        key: _formKey,
        autovalidateMode: _submitted ? AutovalidateMode.onUserInteraction : AutovalidateMode.disabled,
        child: ListView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
          children: [
            _Section(
              icon: CupertinoIcons.person,
              title: 'Informations personnelles',
              children: [
                TextFormField(
                  controller: _nom,
                  enabled: !_loading,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(labelText: 'Nom *', prefixIcon: Icon(CupertinoIcons.person, size: 20)),
                  validator: (v) => Validators.required(v, 'Le nom est requis'),
                ),
                TextFormField(
                  controller: _prenom,
                  enabled: !_loading,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(labelText: 'Prénom *', prefixIcon: Icon(CupertinoIcons.person, size: 20)),
                  validator: (v) => Validators.required(v, 'Le prénom est requis'),
                ),
                TextFormField(
                  controller: _telephone,
                  enabled: !_loading,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'Téléphone *',
                    helperText: '+243 suivi de 9 chiffres (ex : +243999999999)',
                    prefixIcon: Icon(CupertinoIcons.phone, size: 20),
                  ),
                  validator: (v) {
                    if (!Validators.isFilled(v) || v!.trim() == '+243') return 'Le téléphone est requis';
                    if (!Validators.isPhone(v)) {
                      return 'Le téléphone doit commencer par +243 suivi de 9 chiffres';
                    }
                    return null;
                  },
                ),
                _LabeledField(
                  label: 'Sexe *',
                  error: _submitted && _sexe == null ? 'Le sexe est requis' : null,
                  child: SegmentedButton<String>(
                    emptySelectionAllowed: true,
                    showSelectedIcon: false,
                    segments: const [
                      ButtonSegment(value: 'masculin', label: Text('Masculin')),
                      ButtonSegment(value: 'feminin', label: Text('Féminin')),
                    ],
                    selected: {?_sexe},
                    onSelectionChanged: _loading
                        ? null
                        : (value) => setState(() => _sexe = value.isEmpty ? null : value.first),
                  ),
                ),
                _LabeledField(
                  label: 'Date de naissance *',
                  error: _submitted && _birthDate == null ? 'La date de naissance est requise' : null,
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      alignment: Alignment.centerLeft,
                      minimumSize: const Size(0, 52),
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
                      foregroundColor:
                          _birthDate == null ? AppColors.textMuted : AppColors.textPrimary,
                      side: BorderSide(
                        color: _submitted && _birthDate == null ? AppColors.danger : AppColors.border,
                      ),
                    ),
                    onPressed: _loading ? null : _pickDate,
                    icon: const Icon(CupertinoIcons.calendar, color: AppColors.primary, size: 20),
                    label: Text(dateLabel),
                  ),
                ),
                if (_isStudent)
                  TextFormField(
                    controller: _faculte,
                    enabled: !_loading,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(
                      labelText: 'Faculté *',
                      hintText: 'Ex : Sciences, Médecine, Droit…',
                      prefixIcon: Icon(CupertinoIcons.book, size: 20),
                    ),
                    validator: (v) =>
                        Validators.required(v, 'La faculté est requise pour les étudiants'),
                  ),
              ],
            ),
            _Section(
              icon: CupertinoIcons.person_crop_circle,
              title: 'Informations de connexion',
              children: [
                TextFormField(
                  controller: _usernameField,
                  readOnly: true,
                  enableInteractiveSelection: false,
                  canRequestFocus: false,
                  style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.primary),
                  decoration: InputDecoration(
                    labelText: "Nom d'utilisateur",
                    hintText: 'Généré à partir du nom et du prénom',
                    helperText: 'Créé automatiquement : nom + 2 lettres du prénom + 2 chiffres',
                    helperMaxLines: 2,
                    filled: true,
                    fillColor: AppColors.primarySoft,
                    prefixIcon: const Icon(CupertinoIcons.at, size: 20),
                    suffixIcon: IconButton(
                      tooltip: "Générer d'autres chiffres",
                      icon: const Icon(CupertinoIcons.arrow_2_circlepath, size: 20),
                      onPressed: _loading || _usernameField.text.isEmpty ? null : _regenerateUsername,
                    ),
                  ),
                ),
                TextFormField(
                  controller: _email,
                  enabled: !_loading,
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'Email *',
                    helperText: 'Utilisé pour la connexion et les notifications',
                    prefixIcon: Icon(CupertinoIcons.envelope, size: 20),
                  ),
                  validator: (v) {
                    if (!Validators.isFilled(v)) return "L'email est requis";
                    if (!Validators.isEmail(v!)) return "Format d'email invalide";
                    return null;
                  },
                ),
              ],
            ),
            _Section(
              icon: CupertinoIcons.lock_shield,
              title: 'Sécurité du compte',
              children: [
                TextFormField(
                  controller: _password,
                  enabled: !_loading,
                  obscureText: _obscure,
                  textInputAction: TextInputAction.next,
                  decoration: InputDecoration(
                    labelText: 'Mot de passe *',
                    helperText: 'Au moins 8 caractères',
                    prefixIcon: const Icon(CupertinoIcons.lock, size: 20),
                    suffixIcon: IconButton(
                      tooltip: _obscure ? 'Afficher' : 'Masquer',
                      icon: Icon(_obscure ? CupertinoIcons.eye_slash : CupertinoIcons.eye, size: 20),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                  ),
                  validator: (v) {
                    if (!Validators.isFilled(v)) return 'Le mot de passe est requis';
                    if (!Validators.isPassword(v!)) {
                      return 'Le mot de passe doit contenir au moins 8 caractères';
                    }
                    return null;
                  },
                ),
                TextFormField(
                  controller: _confirm,
                  enabled: !_loading,
                  obscureText: _obscure,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'Confirmer le mot de passe *',
                    prefixIcon: Icon(CupertinoIcons.lock, size: 20),
                  ),
                  validator: (v) =>
                      v != _password.text ? 'Les mots de passe ne correspondent pas' : null,
                ),
              ],
            ),
            const SizedBox(height: 8),
            LoadingButton(
              label: 'Créer mon compte',
              loadingLabel: 'Création du compte…',
              icon: CupertinoIcons.checkmark_seal,
              loading: _loading,
              onPressed: _submit,
            ),
            const SizedBox(height: 10),
            TextButton.icon(
              onPressed: _loading ? null : () => Navigator.of(context).pop(),
              icon: const Icon(CupertinoIcons.back, size: 18),
              label: const Text('Modifier la sélection'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.icon, required this.title, required this.children});

  final IconData icon;
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SurfaceCard(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              IconTile(icon, size: 32, iconSize: 17),
              const SizedBox(width: 10),
              Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15.5)),
            ],
          ),
          const SizedBox(height: 14),
          for (final child in children) Padding(padding: const EdgeInsets.only(bottom: 14), child: child),
        ],
      ),
    );
  }
}

class _LabeledField extends StatelessWidget {
  const _LabeledField({required this.label, required this.child, this.error});

  final String label;
  final Widget child;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
        const SizedBox(height: 8),
        child,
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 6, left: 12),
            child: Text(error!, style: const TextStyle(color: AppColors.danger, fontSize: 12)),
          ),
      ],
    );
  }
}
