import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Logo BNN (version blanche pour les fonds bleus, bleue pour les fonds clairs).
class BnnLogo extends StatelessWidget {
  const BnnLogo({super.key, this.height = 40, this.onDark = true});

  final double height;
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      onDark ? 'assets/images/logo_blanc.png' : 'assets/images/logo_bleu.png',
      height: height,
      fit: BoxFit.contain,
      semanticLabel: 'BNN - Bibliothèque Numérique Nationale',
    );
  }
}

/// Pastille d'information (langue, type, format…).
class Pill extends StatelessWidget {
  const Pill(
    this.label, {
    super.key,
    this.color = AppColors.primary,
    this.icon,
    this.filled = false,
  });

  final String label;
  final Color color;
  final IconData? icon;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: filled ? color : color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: filled ? Colors.white : color),
            const SizedBox(width: 4),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.1,
                color: filled ? Colors.white : color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Image réseau avec cache, placeholder et repli en cas d'erreur.
class NetworkCover extends StatelessWidget {
  const NetworkCover({
    super.key,
    required this.url,
    this.width,
    this.height,
    this.radius = 10,
    this.fallbackIcon = CupertinoIcons.book,
    this.fallback,
    this.headers,
    this.fit = BoxFit.cover,
  });

  final String? url;
  final double? width;
  final double? height;
  final double radius;
  final IconData fallbackIcon;

  /// Remplace la vignette par défaut quand l'image est absente ou illisible.
  final Widget? fallback;
  final Map<String, String>? headers;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final placeholder = fallback ?? Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: AppColors.primaryTint),
      ),
      child: Icon(fallbackIcon, color: AppColors.primary.withValues(alpha: 0.5)),
    );
    if (url == null) return placeholder;
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: CachedNetworkImage(
        imageUrl: url!,
        httpHeaders: headers,
        width: width,
        height: height,
        fit: fit,
        memCacheWidth: width != null ? (width! * 3).round() : null,
        placeholder: (_, _) => placeholder,
        errorWidget: (_, _, _) => placeholder,
      ),
    );
  }
}

/// Avatar utilisateur (photo ou initiale).
class UserAvatar extends StatelessWidget {
  const UserAvatar({
    super.key,
    required this.initial,
    this.url,
    this.size = 40,
    this.showOnline = false,
  });

  final String initial;
  final String? url;
  final double size;
  final bool showOnline;

  @override
  Widget build(BuildContext context) {
    final fallback = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
      child: Text(
        initial,
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w700,
          fontSize: size * 0.4,
        ),
      ),
    );
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          if (url == null)
            fallback
          else
            ClipOval(
              child: CachedNetworkImage(
                imageUrl: url!,
                width: size,
                height: size,
                fit: BoxFit.cover,
                placeholder: (_, _) => fallback,
                errorWidget: (_, _, _) => fallback,
              ),
            ),
          if (showOnline)
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                width: size * 0.28,
                height: size * 0.28,
                decoration: BoxDecoration(
                  color: AppColors.success,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Titre de section avec sous-titre optionnel et action à droite.
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.icon,
    this.trailing,
  });

  final String title;
  final String? subtitle;
  final IconData? icon;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        if (icon != null) ...[
          Icon(icon, size: 19, color: AppColors.primary),
          const SizedBox(width: 8),
        ],
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.2,
                  color: AppColors.textPrimary,
                ),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 1),
                Text(
                  subtitle!,
                  style: const TextStyle(fontSize: 12.5, color: AppColors.textMuted),
                ),
              ],
            ],
          ),
        ),
        ?trailing,
      ],
    );
  }
}

/// Champ de recherche arrondi avec bouton d'effacement.
class SearchField extends StatelessWidget {
  const SearchField({
    super.key,
    required this.controller,
    required this.hint,
    this.onChanged,
    this.onSubmitted,
    this.onClear,
    this.focusNode,
    this.autofocus = false,
    this.onDark = false,
  });

  final TextEditingController controller;
  final String hint;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final VoidCallback? onClear;
  final FocusNode? focusNode;
  final bool autofocus;

  /// Champ posé sur l'en-tête bleu : fond blanc sans bordure.
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      borderSide: onDark ? BorderSide.none : AppTheme.hairline,
    );
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (context, value, _) => TextField(
        controller: controller,
        focusNode: focusNode,
        autofocus: autofocus,
        onChanged: onChanged,
        onSubmitted: onSubmitted,
        textInputAction: TextInputAction.search,
        style: const TextStyle(fontSize: 15),
        decoration: InputDecoration(
          hintText: hint,
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(vertical: 13),
          prefixIcon: const Icon(CupertinoIcons.search, size: 20),
          suffixIcon: value.text.isEmpty
              ? null
              : IconButton(
                  tooltip: 'Effacer',
                  icon: const Icon(CupertinoIcons.xmark_circle_fill, size: 19, color: AppColors.textFaint),
                  onPressed: () {
                    controller.clear();
                    onChanged?.call('');
                    onClear?.call();
                  },
                ),
          border: border,
          enabledBorder: border,
          focusedBorder: border.copyWith(
            borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
          ),
        ),
      ),
    );
  }
}

/// Bandeau bleu uni de l'identité BNN (sans dégradé ni ombre).
class BrandHeader extends StatelessWidget {
  const BrandHeader({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.fromLTRB(20, 8, 20, 20),
  });

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: AppColors.navy,
      padding: padding,
      child: child,
    );
  }
}

/// En-tête des onglets principaux : grand titre, sous-titre, actions et
/// contenu optionnel (recherche, sélecteur…), sur le bandeau bleu BNN.
class TabHeader extends StatelessWidget {
  const TabHeader({
    super.key,
    this.title,
    this.leading,
    this.eyebrow,
    this.subtitle,
    this.actions = const [],
    this.bottom,
  });

  final String? title;

  /// Remplace le titre (ex. logo BNN sur l'accueil).
  final Widget? leading;

  /// Petite mention au-dessus du titre (ex. « Bibliothèque personnelle »).
  final String? eyebrow;
  final String? subtitle;
  final List<Widget> actions;
  final Widget? bottom;

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Container(
        width: double.infinity,
        color: AppColors.navy,
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 10, 12, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (eyebrow != null)
                            Text(
                              eyebrow!.toUpperCase(),
                              style: const TextStyle(
                                color: AppColors.cyan,
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.8,
                              ),
                            ),
                          if (leading != null)
                            leading!
                          else if (title != null)
                            Semantics(
                              header: true,
                              child: Text(
                                title!,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 28,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: -0.5,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    ...actions,
                  ],
                ),
                if (subtitle != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4, right: 8),
                    child: Text(
                      subtitle!,
                      style: const TextStyle(color: AppColors.onNavyMuted, fontSize: 13.5, height: 1.4),
                    ),
                  ),
                if (bottom != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 14, right: 8),
                    child: bottom,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Bouton rond translucide pour les actions posées sur le bandeau bleu.
class HeaderIconButton extends StatelessWidget {
  const HeaderIconButton({
    super.key,
    required this.icon,
    required this.tooltip,
    required this.onPressed,
    this.badge,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;

  /// Pastille numérique (notifications…) ; masquée si nulle ou à zéro.
  final int? badge;

  @override
  Widget build(BuildContext context) {
    final count = badge ?? 0;
    return Padding(
      padding: const EdgeInsets.only(left: 6),
      child: IconButton(
        tooltip: tooltip,
        onPressed: onPressed,
        style: IconButton.styleFrom(
          backgroundColor: AppColors.onNavySoft,
          foregroundColor: Colors.white,
          disabledForegroundColor: AppColors.onNavyMuted,
          minimumSize: const Size(42, 42),
        ),
        icon: Badge.count(
          count: count,
          isLabelVisible: count > 0,
          child: Icon(icon, size: 21),
        ),
      ),
    );
  }
}

/// Surface blanche bordée (carte) avec action au toucher optionnelle.
class SurfaceCard extends StatelessWidget {
  const SurfaceCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(14),
    this.radius = AppTheme.radiusLg,
    this.borderColor = AppColors.border,
    this.color = AppColors.surface,
    this.margin,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final double radius;
  final Color borderColor;
  final Color color;
  final EdgeInsetsGeometry? margin;

  @override
  Widget build(BuildContext context) {
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(radius),
      side: BorderSide(color: borderColor),
    );
    return Padding(
      padding: margin ?? EdgeInsets.zero,
      child: Material(
        color: color,
        shape: shape,
        clipBehavior: Clip.antiAlias,
        child: onTap == null
            ? Padding(padding: padding, child: child)
            : InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
      ),
    );
  }
}

/// Icône sur pastille teintée (listes, réglages, catégories).
class IconTile extends StatelessWidget {
  const IconTile(
    this.icon, {
    super.key,
    this.color = AppColors.primary,
    this.size = 40,
    this.iconSize,
    this.radius,
    this.solid = false,
  });

  final IconData icon;
  final Color color;
  final double size;
  final double? iconSize;
  final double? radius;

  /// Fond plein (icône blanche) plutôt que teinté.
  final bool solid;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: solid ? color : color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(radius ?? size * 0.28),
      ),
      child: Icon(icon, color: solid ? Colors.white : color, size: iconSize ?? size * 0.5),
    );
  }
}

/// Groupe de lignes séparées par des filets (style liste groupée iOS).
class GroupedSection extends StatelessWidget {
  const GroupedSection({super.key, required this.children, this.indent = 64});

  final List<Widget> children;
  final double indent;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        side: AppTheme.hairline,
      ),
      child: Column(
        children: [
          for (final (index, child) in children.indexed) ...[
            if (index > 0) Divider(indent: indent),
            child,
          ],
        ],
      ),
    );
  }
}

/// Ligne d'information « libellé / valeur » avec icône.
class InfoRow extends StatelessWidget {
  const InfoRow({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.extra,
    this.selectable = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final String? extra;
  final bool selectable;

  @override
  Widget build(BuildContext context) {
    const valueStyle = TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5, height: 1.35, color: AppColors.textPrimary);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IconTile(icon, size: 32, iconSize: 16),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textMuted, fontWeight: FontWeight.w500)),
                const SizedBox(height: 2),
                selectable ? SelectableText(value, style: valueStyle) : Text(value, style: valueStyle),
                if (extra != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(extra!, style: const TextStyle(fontSize: 12.5, color: AppColors.textMuted)),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Ligne de navigation (icône, titre, description, chevron).
class NavRow extends StatelessWidget {
  const NavRow({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
    this.color = AppColors.primary,
    this.trailing,
    this.destructive = false,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final Color color;
  final Widget? trailing;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final tint = destructive ? AppColors.danger : color;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
        child: Row(
          children: [
            IconTile(icon, color: tint, size: 34, iconSize: 18, solid: !destructive),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                      color: destructive ? AppColors.danger : AppColors.textPrimary,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 1),
                    Text(subtitle!, style: const TextStyle(color: AppColors.textMuted, fontSize: 12.5)),
                  ],
                ],
              ),
            ),
            trailing ?? (destructive ? const SizedBox.shrink() : const Icon(CupertinoIcons.chevron_right, size: 16, color: AppColors.textFaint)),
          ],
        ),
      ),
    );
  }
}

/// Option d'un [Segmented].
class SegmentOption<T> {
  const SegmentOption(this.value, this.label, {this.icon});

  final T value;
  final String label;
  final IconData? icon;
}

/// Sélecteur segmenté plat (sans ombre), utilisable sur fond clair ou bleu.
class Segmented<T> extends StatelessWidget {
  const Segmented({
    super.key,
    required this.options,
    required this.value,
    required this.onChanged,
    this.onDark = false,
  });

  final List<SegmentOption<T>> options;
  final T value;
  final ValueChanged<T> onChanged;
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final track = onDark ? AppColors.onNavySoft : AppColors.fill;
    final idle = onDark ? AppColors.onNavyMuted : AppColors.textMuted;
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(color: track, borderRadius: BorderRadius.circular(AppTheme.radiusMd)),
      child: Row(
        children: [
          for (final option in options)
            Expanded(
              child: Semantics(
                selected: option.value == value,
                button: true,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => onChanged(option.value),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 6),
                    decoration: BoxDecoration(
                      color: option.value == value ? Colors.white : Colors.transparent,
                      borderRadius: BorderRadius.circular(AppTheme.radiusMd - 3),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (option.icon != null) ...[
                          Icon(option.icon, size: 16, color: option.value == value ? AppColors.primary : idle),
                          const SizedBox(width: 6),
                        ],
                        Flexible(
                          child: Text(
                            option.label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 13.5,
                              color: option.value == value ? AppColors.primary : idle,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Tirer pour actualiser, sans élévation.
class AppRefresh extends StatelessWidget {
  const AppRefresh({super.key, required this.onRefresh, required this.child});

  final Future<void> Function() onRefresh;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      elevation: 0,
      color: AppColors.primary,
      backgroundColor: AppColors.surface,
      child: child,
    );
  }
}

/// Barre de puces horizontale défilante (filtres).
class ChipBar extends StatelessWidget {
  const ChipBar({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
    this.padding = const EdgeInsets.fromLTRB(16, 12, 16, 4),
    this.height = 54,
  });

  final int itemCount;
  final IndexedWidgetBuilder itemBuilder;
  final EdgeInsets padding;
  final double height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: ListView.separated(
        padding: padding,
        scrollDirection: Axis.horizontal,
        itemCount: itemCount,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: itemBuilder,
      ),
    );
  }
}

/// Titre et sous-titre d'une feuille modale.
class SheetHeader extends StatelessWidget {
  const SheetHeader({super.key, required this.title, this.subtitle, this.trailing, this.icon});

  final String title;
  final String? subtitle;
  final Widget? trailing;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 12, 12),
      child: Row(
        children: [
          if (icon != null) ...[
            IconTile(icon!, size: 38, iconSize: 19),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
                if (subtitle != null)
                  Text(subtitle!, style: const TextStyle(fontSize: 13, color: AppColors.textMuted)),
              ],
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}
