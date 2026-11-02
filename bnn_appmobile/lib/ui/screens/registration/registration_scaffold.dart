import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/app_colors.dart';
import '../../../data/models/registration.dart';
import '../../widgets/common.dart';

/// Gabarit des étapes d'inscription : barre de progression et rappel
/// des choix déjà effectués (province, établissement, type).
class RegistrationScaffold extends StatelessWidget {
  const RegistrationScaffold({
    super.key,
    required this.step,
    required this.title,
    required this.subtitle,
    required this.selection,
    required this.body,
    this.header,
  });

  static const totalSteps = 4;

  final int step;
  final String title;
  final String subtitle;
  final RegistrationSelection selection;
  final Widget body;
  final Widget? header;

  @override
  Widget build(BuildContext context) {
    final chips = <(IconData, String)>[
      if (selection.province != null) (CupertinoIcons.location_fill, selection.province!.nom),
      if (selection.universite != null)
        (
          CupertinoIcons.building_2_fill,
          selection.universite!.shortname.isNotEmpty
              ? selection.universite!.shortname
              : selection.universite!.nom,
        ),
      if (selection.userType != null) (CupertinoIcons.person_crop_circle, selection.userType!.name),
    ];

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.navy,
        foregroundColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.white),
        systemOverlayStyle: SystemUiOverlayStyle.light,
        shape: const Border(),
        titleTextStyle: Theme.of(context).appBarTheme.titleTextStyle?.copyWith(color: Colors.white),
        title: const Text('Créer un compte'),
        actions: [
          TextButton(
            style: TextButton.styleFrom(foregroundColor: Colors.white),
            onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
            child: const Text('Connexion'),
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            color: AppColors.navy,
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: List.generate(totalSteps, (index) {
                    final active = index < step;
                    return Expanded(
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        height: 4,
                        margin: EdgeInsets.only(right: index == totalSteps - 1 ? 0 : 6),
                        decoration: BoxDecoration(
                          color: active ? AppColors.cyan : AppColors.onNavySoft,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    );
                  }),
                ),
                const SizedBox(height: 16),
                Text(
                  'Étape $step sur $totalSteps',
                  style: const TextStyle(color: AppColors.cyan, fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.4),
                ),
                const SizedBox(height: 4),
                Text(
                  title,
                  style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: -0.4),
                ),
                const SizedBox(height: 4),
                Text(subtitle, style: const TextStyle(color: AppColors.onNavyMuted, height: 1.4)),
                if (chips.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final (icon, label) in chips)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: AppColors.onNavySoft,
                            borderRadius: BorderRadius.circular(99),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(icon, size: 14, color: AppColors.cyan),
                              const SizedBox(width: 6),
                              ConstrainedBox(
                                constraints: const BoxConstraints(maxWidth: 220),
                                child: Text(
                                  label,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          ?header,
          Expanded(child: body),
        ],
      ),
    );
  }
}

/// Carte sélectionnable utilisée dans les listes d'inscription.
class SelectableTile extends StatelessWidget {
  const SelectableTile({
    super.key,
    required this.leading,
    required this.title,
    this.subtitle,
    required this.onTap,
  });

  final Widget leading;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              leading,
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                    ),
                    if (subtitle != null && subtitle!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(subtitle!, style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
                    ],
                  ],
                ),
              ),
              const Icon(CupertinoIcons.chevron_right, size: 16, color: AppColors.textFaint),
            ],
          ),
        ),
      ),
    );
  }
}

class IconBadge extends StatelessWidget {
  const IconBadge(this.icon, {super.key, this.size = 46});

  final IconData icon;
  final double size;

  @override
  Widget build(BuildContext context) {
    return IconTile(icon, size: size, iconSize: size * 0.46, radius: 13);
  }
}
