import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

enum FeedbackKind { success, error, info }

/// Retour utilisateur non bloquant (équivalent des toasts BNN Web).
void showFeedback(BuildContext context, String message, {FeedbackKind kind = FeedbackKind.info}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  final (icon, color) = switch (kind) {
    FeedbackKind.success => (CupertinoIcons.checkmark_circle_fill, AppColors.success),
    FeedbackKind.error => (CupertinoIcons.exclamationmark_circle_fill, const Color(0xFFF87171)),
    FeedbackKind.info => (CupertinoIcons.info_circle_fill, AppColors.cyan),
  };
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        duration: Duration(seconds: kind == FeedbackKind.error ? 5 : 3),
        content: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 10),
            Expanded(child: Text(message)),
          ],
        ),
      ),
    );
}

void showSuccess(BuildContext context, String message) =>
    showFeedback(context, message, kind: FeedbackKind.success);

void showError(BuildContext context, String message) =>
    showFeedback(context, message, kind: FeedbackKind.error);

void showInfo(BuildContext context, String message) =>
    showFeedback(context, message, kind: FeedbackKind.info);

/// Boîte de confirmation standard ; retourne `true` si l'utilisateur confirme.
Future<bool> confirmAction(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Confirmer',
  bool destructive = false,
  IconData? icon,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      icon: icon != null
          ? Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: (destructive ? AppColors.danger : AppColors.primary).withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: destructive ? AppColors.danger : AppColors.primary, size: 26),
            )
          : null,
      title: Text(title, textAlign: TextAlign.center),
      content: Text(message, textAlign: TextAlign.center),
      actionsAlignment: MainAxisAlignment.center,
      actionsPadding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      actions: [
        OutlinedButton(
          style: OutlinedButton.styleFrom(foregroundColor: AppColors.textSecondary),
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Annuler'),
        ),
        FilledButton(
          style: destructive
              ? FilledButton.styleFrom(backgroundColor: AppColors.danger)
              : null,
          onPressed: () => Navigator.of(context).pop(true),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return result ?? false;
}
