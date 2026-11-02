import 'package:flutter/cupertino.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../data/models/ressource.dart';
import 'common.dart';

/// Icône et couleur associées à un format de fichier.
(IconData, Color) formatVisual(String? format) {
  final f = (format ?? '').toLowerCase();
  if (f == 'pdf') return (CupertinoIcons.doc_text_fill, AppColors.pdf);
  if (f == 'epub') return (CupertinoIcons.book_fill, AppColors.primary);
  if (['mp4', 'avi', 'mov', 'video', 'webm', 'mkv'].contains(f)) {
    return (CupertinoIcons.play_rectangle_fill, AppColors.video);
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'image'].contains(f)) return (CupertinoIcons.photo_fill, AppColors.image);
  if (['mp3', 'wav', 'audio'].contains(f)) return (CupertinoIcons.waveform, AppColors.warning);
  return (CupertinoIcons.doc_fill, AppColors.textMuted);
}

/// Icône représentant une catégorie documentaire (livre, thèse, vidéo…).
IconData typeIcon(String? type) => switch ((type ?? '').toLowerCase().trim()) {
      'all' => CupertinoIcons.square_grid_2x2,
      'livre' || 'monographie' => CupertinoIcons.book,
      'article' || 'revue' => CupertinoIcons.news,
      'these' => CupertinoIcons.doc_richtext,
      'rapport' => CupertinoIcons.doc_chart,
      'conference' => CupertinoIcons.person_3,
      'audio' || 'podcast' => CupertinoIcons.waveform,
      'video' => CupertinoIcons.play_rectangle,
      'image' => CupertinoIcons.photo,
      'cours' || 'presentation' => CupertinoIcons.rectangle_stack,
      'logiciel' => CupertinoIcons.square_stack_3d_up,
      _ => CupertinoIcons.doc_text,
    };

/// Couverture d'une ressource : vignette réseau, ou logo HAL pour les
/// ressources externes.
class ResourceCover extends StatelessWidget {
  const ResourceCover({super.key, required this.ressource, required this.width, required this.height, this.radius = 8});

  final Ressource ressource;
  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    if (ressource.isExternal) {
      return Container(
        width: width,
        height: height,
        padding: EdgeInsets.all(width * 0.14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(radius),
          border: Border.all(color: AppColors.border),
        ),
        child: Image.asset('assets/images/hal_logo.png', fit: BoxFit.contain),
      );
    }
    return NetworkCover(
      url: ressource.coverUrl,
      width: width,
      height: height,
      radius: radius,
      fallbackIcon: typeIcon(ressource.type),
    );
  }
}

/// Carte d'une ressource en liste (couverture, titre, domaine, badges).
class ResourceCard extends StatelessWidget {
  const ResourceCard({
    super.key,
    required this.ressource,
    required this.onTap,
    this.trailing,
    this.footer,
  });

  final Ressource ressource;
  final VoidCallback onTap;
  final Widget? trailing;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final (formatIcon, formatColor) = formatVisual(ressource.format);
    final subtitle = ressource.isExternal ? ressource.auteurs : ressource.domaineNom;
    final typeLabel = ressource.isExternal ? (ressource.type ?? 'Publication') : ressource.typeLabel;
    final date = ressource.datePublication == null
        ? null
        : ressource.isExternal
            ? ressource.datePublication!
            : formatShortDate(ressource.datePublication);

    return SurfaceCard(
      onTap: onTap,
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  ResourceCover(ressource: ressource, width: 62, height: 86),
                  if (ressource.format != null)
                    Positioned(
                      right: -5,
                      bottom: -5,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(7),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Icon(formatIcon, size: 13, color: formatColor),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(typeIcon(ressource.type), size: 13, color: AppColors.primary),
                        const SizedBox(width: 5),
                        Flexible(
                          child: Text(
                            typeLabel.toUpperCase(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.6,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      ressource.titre,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                        height: 1.28,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    if (subtitle != null && subtitle.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                      ),
                    ],
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        if (ressource.langue != null && ressource.langue!.isNotEmpty)
                          Pill(ressource.langue!.toUpperCase(), color: AppColors.navy),
                        if (ressource.format != null)
                          Pill(ressource.format!.toUpperCase(), color: formatColor),
                        if (date != null)
                          Pill(date, color: AppColors.textMuted, icon: CupertinoIcons.calendar),
                      ],
                    ),
                  ],
                ),
              ),
              ?trailing,
            ],
          ),
          ?footer,
        ],
      ),
    );
  }
}
