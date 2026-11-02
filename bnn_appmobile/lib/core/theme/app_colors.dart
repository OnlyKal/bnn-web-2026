import 'package:flutter/material.dart';

/// Palette reprise de la charte BNN Web (`src/index.css`).
///
/// Charte mobile : couleurs unies uniquement (ni dégradé, ni ombre portée),
/// bordures fines pour séparer les surfaces.
class AppColors {
  AppColors._();

  static const Color primary = Color(0xFF1E42AC); // --primary-blue
  static const Color navy = Color(0xFF053677); // en-tête Web
  static const Color deep = Color(0xFF0A1F38); // --primary-blue-hover
  static const Color ink = Color(0xFF152033);
  static const Color cyan = Color(0xFF46E9FE); // --cyan-accent
  static const Color primarySoft = Color(0xFFEEF3FB);
  static const Color primaryTint = Color(0xFFE5ECF5);

  /// Surfaces posées sur l'en-tête bleu (champ, onglet inactif…).
  static const Color onNavySoft = Color(0x1FFFFFFF);
  static const Color onNavyMuted = Color(0xB3FFFFFF);

  static const Color background = Color(0xFFF4F6FA);
  static const Color surface = Colors.white;
  static const Color fill = Color(0xFFEFF2F7);
  static const Color border = Color(0xFFE3E8EF);
  static const Color divider = Color(0xFFEEF1F5);

  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF334155);
  static const Color textMuted = Color(0xFF64748B);
  static const Color textFaint = Color(0xFF94A3B8);

  static const Color success = Color(0xFF10B981);
  static const Color successDark = Color(0xFF059669);
  static const Color danger = Color(0xFFDC2626);
  static const Color warning = Color(0xFFF59E0B);
  static const Color rose = Color(0xFFE11D48);
  static const Color violet = Color(0xFF7C3AED);

  static const Color pdf = Color(0xFFEF4444);
  static const Color video = Color(0xFF3B82F6);
  static const Color image = Color(0xFF22C55E);
}
