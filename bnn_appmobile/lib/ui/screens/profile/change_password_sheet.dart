import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../app_services.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/validators.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';
import '../auth/auth_scaffold.dart';

class ChangePasswordSheet extends StatefulWidget {
  const ChangePasswordSheet({super.key});

  @override
  State<ChangePasswordSheet> createState() => _ChangePasswordSheetState();
}

class _ChangePasswordSheetState extends State<ChangePasswordSheet> {
  final _old = TextEditingController();
  final _new = TextEditingController();
  final _confirm = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  List<String> _errors = const [];

  @override
  void dispose() {
    _old.dispose();
    _new.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final errors = Validators.passwordChange(_old.text, _new.text, _confirm.text);
    setState(() => _errors = errors);
    if (errors.isNotEmpty) return;
    setState(() => _loading = true);
    try {
      await context.read<AppServices>().users.changePassword(_old.text, _new.text);
      if (!mounted) return;
      showSuccess(context, 'Mot de passe mis à jour avec succès !');
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Widget _field(TextEditingController controller, String label, {TextInputAction action = TextInputAction.next}) {
    return TextField(
      controller: controller,
      enabled: !_loading,
      obscureText: _obscure,
      textInputAction: action,
      onSubmitted: action == TextInputAction.done ? (_) => _submit() : null,
      decoration: InputDecoration(labelText: label, prefixIcon: const Icon(CupertinoIcons.lock, size: 20)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const IconTile(CupertinoIcons.lock_shield_fill, size: 38, iconSize: 19),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text('Changer le mot de passe',
                        style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
                  ),
                  IconButton(
                    tooltip: _obscure ? 'Afficher les mots de passe' : 'Masquer les mots de passe',
                    onPressed: () => setState(() => _obscure = !_obscure),
                    icon: Icon(_obscure ? CupertinoIcons.eye_slash : CupertinoIcons.eye, color: AppColors.textMuted),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _field(_old, 'Ancien mot de passe'),
              const SizedBox(height: 12),
              _field(_new, 'Nouveau mot de passe (8 caractères min.)'),
              const SizedBox(height: 12),
              _field(_confirm, 'Confirmer le nouveau mot de passe', action: TextInputAction.done),
              if (_errors.isNotEmpty) ...[
                const SizedBox(height: 12),
                for (final error in _errors)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(CupertinoIcons.exclamationmark_circle, size: 16, color: AppColors.danger),
                        const SizedBox(width: 6),
                        Expanded(child: Text(error, style: const TextStyle(color: AppColors.danger, fontSize: 13))),
                      ],
                    ),
                  ),
              ],
              const SizedBox(height: 18),
              LoadingButton(
                label: 'Mettre à jour',
                loadingLabel: 'Mise à jour…',
                icon: CupertinoIcons.lock_shield,
                loading: _loading,
                onPressed: _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
