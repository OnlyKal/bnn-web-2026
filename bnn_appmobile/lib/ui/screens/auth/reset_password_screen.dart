import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../app_services.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/validators.dart';
import '../../widgets/feedback.dart';
import 'auth_scaffold.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _loading = false;
  String? _successMessage;
  Timer? _redirect;

  @override
  void dispose() {
    _redirect?.cancel();
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      final message = await context.read<AppServices>().auth.resetPassword(_email.text);
      if (!mounted) return;
      setState(() => _successMessage = message);
      showSuccess(context, message);
      _redirect = Timer(const Duration(seconds: 4), () {
        if (mounted) Navigator.of(context).maybePop();
      });
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final done = _successMessage != null;
    return AuthScaffold(
      showBack: true,
      title: 'Mot de passe oublié',
      subtitle: 'Entrez votre adresse email pour recevoir un nouveau mot de passe.',
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (done)
              Container(
                padding: const EdgeInsets.all(14),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(CupertinoIcons.envelope_open, color: AppColors.successDark),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        '$_successMessage\nRetour à la connexion dans un instant…',
                        style: const TextStyle(color: AppColors.successDark, height: 1.35),
                      ),
                    ),
                  ],
                ),
              ),
            TextFormField(
              controller: _email,
              enabled: !_loading && !done,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              autocorrect: false,
              textInputAction: TextInputAction.send,
              decoration: const InputDecoration(
                labelText: 'Adresse email',
                prefixIcon: Icon(CupertinoIcons.envelope, size: 20),
              ),
              validator: (v) {
                if (!Validators.isFilled(v)) return 'Veuillez entrer votre adresse email';
                if (!Validators.isEmail(v!)) return 'Veuillez entrer une adresse email valide';
                return null;
              },
              onFieldSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: 18),
            LoadingButton(
              label: done ? 'Email envoyé' : 'Envoyer',
              loadingLabel: 'Envoi en cours…',
              icon: done ? CupertinoIcons.checkmark_alt : CupertinoIcons.paperplane,
              loading: _loading,
              onPressed: done ? null : _submit,
            ),
            const SizedBox(height: 14),
            const Text(
              'Vous recevrez un email avec votre nouveau mot de passe. Pensez à vérifier votre dossier spam.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textMuted, fontSize: 12.5, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }
}
