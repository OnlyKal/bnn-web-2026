import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../state/session_controller.dart';
import '../../widgets/feedback.dart';
import '../registration/province_screen.dart';
import 'auth_scaffold.dart';
import 'reset_password_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _password = TextEditingController();
  final _passwordFocus = FocusNode();
  bool _obscure = true;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final message = context.read<SessionController>().consumeExpiredMessage();
      if (message != null && mounted) showInfo(context, message);
    });
  }

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      final message = await context.read<SessionController>().login(
            _username.text.trim(),
            _password.text,
          );
      if (mounted) showSuccess(context, message ?? 'Connexion réussie !');
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Connexion',
      subtitle: 'Accédez aux ressources de la Bibliothèque Numérique Nationale.',
      child: AutofillGroup(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _username,
                enabled: !_loading,
                autofillHints: const [AutofillHints.username, AutofillHints.email],
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autocorrect: false,
                decoration: const InputDecoration(
                  labelText: "Nom d'utilisateur ou email",
                  prefixIcon: Icon(CupertinoIcons.person, size: 20),
                ),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Veuillez saisir votre identifiant' : null,
                onFieldSubmitted: (_) => _passwordFocus.requestFocus(),
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _password,
                focusNode: _passwordFocus,
                enabled: !_loading,
                obscureText: _obscure,
                autofillHints: const [AutofillHints.password],
                textInputAction: TextInputAction.done,
                decoration: InputDecoration(
                  labelText: 'Mot de passe',
                  prefixIcon: const Icon(CupertinoIcons.lock, size: 20),
                  suffixIcon: IconButton(
                    tooltip: _obscure ? 'Afficher le mot de passe' : 'Masquer le mot de passe',
                    icon: Icon(_obscure ? CupertinoIcons.eye_slash : CupertinoIcons.eye, size: 20),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Veuillez saisir votre mot de passe' : null,
                onFieldSubmitted: (_) => _submit(),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: _loading
                      ? null
                      : () => Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const ResetPasswordScreen()),
                          ),
                  child: const Text('Mot de passe oublié ?'),
                ),
              ),
              const SizedBox(height: 4),
              LoadingButton(
                label: 'Se connecter',
                loadingLabel: 'Connexion…',
                icon: CupertinoIcons.arrow_right_circle,
                loading: _loading,
                onPressed: _submit,
              ),
              const SizedBox(height: 18),
              const Divider(),
              const SizedBox(height: 8),
              Wrap(
                alignment: WrapAlignment.center,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  const Text('Pas encore de compte ?', style: TextStyle(color: AppColors.textMuted)),
                  TextButton(
                    onPressed: _loading
                        ? null
                        : () => Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => const ProvinceScreen()),
                            ),
                    child: const Text('Créer un compte'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
