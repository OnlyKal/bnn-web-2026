import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../widgets/common.dart';
import '../../widgets/external_links.dart';

/// États communs des lecteurs : téléchargement avec progression et erreur.
class ViewerLoading extends StatelessWidget {
  const ViewerLoading({super.key, required this.progress, this.label = 'Chargement du document…'});

  final double? progress;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const IconTile(CupertinoIcons.book, size: 60, iconSize: 28, radius: 18),
            const SizedBox(height: 18),
            Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 14),
            SizedBox(
              width: 200,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(value: progress, minHeight: 5),
              ),
            ),
            if (progress != null) ...[
              const SizedBox(height: 8),
              Text('${(progress! * 100).round()} %', style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
            ],
          ],
        ),
      ),
    );
  }
}

class ViewerError extends StatelessWidget {
  const ViewerError({super.key, required this.message, required this.onRetry, this.browserUrl});

  final String message;
  final VoidCallback onRetry;
  final String? browserUrl;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const IconTile(CupertinoIcons.exclamationmark_triangle, color: AppColors.danger, size: 60, iconSize: 28, radius: 18),
            const SizedBox(height: 16),
            const Text('Document inaccessible', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textMuted)),
            const SizedBox(height: 18),
            FilledButton.icon(onPressed: onRetry, icon: const Icon(CupertinoIcons.arrow_clockwise, size: 18), label: const Text('Réessayer')),
            if (browserUrl != null) ...[
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: () => openExternalUrl(context, browserUrl),
                icon: const Icon(CupertinoIcons.arrow_up_right_square, size: 18),
                label: const Text('Ouvrir dans le navigateur'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
