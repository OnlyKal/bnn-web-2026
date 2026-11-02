import 'dart:convert';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../../app_services.dart';
import '../../../core/config.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/app_user.dart';
import '../../../data/models/history_item.dart';
import '../../../state/favorites_controller.dart';
import '../../../state/history_controller.dart';
import '../../../state/session_controller.dart';
import '../../../state/shell_controller.dart';
import '../../widgets/common.dart';
import '../../widgets/external_links.dart';
import '../../widgets/feedback.dart';
import '../stats/statistics_screen.dart';
import 'change_password_sheet.dart';
import 'edit_profile_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _avatarUploading = false;

  static const _maxAvatarBytes = 5 * 1024 * 1024;
  static const _allowedExtensions = {'jpg': 'jpeg', 'jpeg': 'jpeg', 'png': 'png', 'gif': 'gif', 'webp': 'webp'};

  void _logAction(String title, String description, {String? target}) {
    context.read<HistoryController>().add(
          type: HistoryType.action,
          title: title,
          description: description,
          target: target ?? HistoryTarget.profile,
        );
  }

  Future<void> _changeAvatar() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SheetHeader(
              title: 'Photo de profil',
              subtitle: 'JPG, PNG, GIF ou WebP · 5 Mo maximum',
              icon: CupertinoIcons.camera,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
              child: GroupedSection(
                children: [
                  NavRow(
                    icon: CupertinoIcons.photo_on_rectangle,
                    title: 'Choisir dans la galerie',
                    onTap: () => Navigator.of(context).pop(ImageSource.gallery),
                  ),
                  NavRow(
                    icon: CupertinoIcons.camera,
                    title: 'Prendre une photo',
                    onTap: () => Navigator.of(context).pop(ImageSource.camera),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
    if (source == null || !mounted) return;

    final XFile? file;
    try {
      file = await ImagePicker().pickImage(source: source, maxWidth: 1024, maxHeight: 1024, imageQuality: 85);
    } catch (_) {
      if (mounted) showError(context, "Impossible d'accéder aux photos. Vérifiez les autorisations de l'application.");
      return;
    }
    if (file == null || !mounted) return;

    final extension = file.name.split('.').last.toLowerCase();
    final mime = _allowedExtensions[extension];
    if (mime == null) {
      showError(context, 'Type de fichier non supporté. Utilisez JPG, PNG, GIF ou WebP.');
      return;
    }
    final bytes = await file.readAsBytes();
    if (!mounted) return;
    if (bytes.length > _maxAvatarBytes) {
      showError(context, 'Le fichier est trop volumineux. Taille maximale : 5 Mo.');
      return;
    }

    setState(() => _avatarUploading = true);
    final session = context.read<SessionController>();
    try {
      final avatar = await context.read<AppServices>().users.updateAvatar('data:image/$mime;base64,${base64Encode(bytes)}');
      final user = session.user;
      if (user != null) await session.updateUser({...user.raw, 'avatar': ?avatar});
      await session.refreshProfile();
      if (mounted) showSuccess(context, 'Avatar mis à jour avec succès !');
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    } finally {
      if (mounted) setState(() => _avatarUploading = false);
    }
  }

  Future<void> _logout() async {
    final ok = await confirmAction(
      context,
      title: 'Se déconnecter ?',
      message: 'Vous devrez saisir à nouveau vos identifiants pour accéder à la BNN.',
      confirmLabel: 'Déconnexion',
      destructive: true,
      icon: CupertinoIcons.square_arrow_right,
    );
    if (!ok || !mounted) return;
    _logAction('Déconnexion', 'Session fermée depuis le profil');
    final favorites = context.read<FavoritesController>();
    await context.read<SessionController>().logout();
    favorites.reset();
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<SessionController>().user;
    if (user == null) return const Scaffold(body: Center(child: CupertinoActivityIndicator()));
    final favoritesCount = context.select<FavoritesController, int>((c) => c.count);
    final history = context.watch<HistoryController>().items;
    final consulted = history.where((h) => h.type == HistoryType.resource).length;
    final searches = history.where((h) => h.type == HistoryType.search).length;
    final shell = context.read<ShellController>();

    void openEdit() {
      _logAction('Action rapide : Paramètres', 'Édition du profil utilisateur');
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const EditProfileScreen()));
    }

    final library = <_QuickAction>[
      _QuickAction(CupertinoIcons.heart_fill, 'Mes favoris', 'Retrouver vos ressources enregistrées', () {
        _logAction('Action rapide : Mes favoris', 'Ouverture des favoris depuis le profil', target: HistoryTarget.favorites);
        shell.goTo(AppTab.favorites);
      }, color: AppColors.rose),
      _QuickAction(CupertinoIcons.book_fill, 'Mes ressources', 'Parcourir la bibliothèque disponible', () {
        _logAction('Action rapide : Mes ressources', 'Retour vers la bibliothèque', target: HistoryTarget.home);
        shell.goTo(AppTab.home);
      }),
      _QuickAction(CupertinoIcons.clock_fill, 'Historique', 'Revoir vos dernières activités locales', () {
        _logAction('Action rapide : Historique', 'Ouverture de l’historique local', target: HistoryTarget.history);
        shell.goTo(AppTab.history);
      }, color: AppColors.navy),
      if (user.isAdmin)
        _QuickAction(CupertinoIcons.chart_bar_alt_fill, 'Rapports statistiques', 'Analyser les ajouts et modifications', () {
          _logAction('Action rapide : Rapports statistiques', 'Ouverture du rapport des ajouts et modifications',
              target: HistoryTarget.statistics);
          Navigator.of(context).push(MaterialPageRoute(builder: (_) => const StatisticsScreen()));
        }, color: AppColors.warning),
    ];
    final account = <_QuickAction>[
      _QuickAction(CupertinoIcons.person_crop_circle, 'Modifier le profil', 'Mettre à jour vos informations', openEdit),
      _QuickAction(CupertinoIcons.lock_shield_fill, 'Modifier le mot de passe', 'Renforcer la sécurité du compte', () {
        _logAction('Action rapide : Mot de passe', 'Ouverture du formulaire de sécurité');
        showModalBottomSheet<void>(context: context, isScrollControlled: true, builder: (_) => const ChangePasswordSheet());
      }, color: AppColors.successDark),
    ];
    final platforms = <_QuickAction>[
      _QuickAction(CupertinoIcons.person_3_fill, 'Classroom', 'Plateforme de cours en ligne',
          () => openExternalUrl(context, AppConfig.classroomUrl), external: true),
      _QuickAction(CupertinoIcons.globe, 'Portail', 'Portail de la BNN-ESURSI',
          () => openExternalUrl(context, AppConfig.portailUrl), color: AppColors.navy, external: true),
    ];

    Widget group(String title, List<_QuickAction> actions) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _GroupLabel(title),
            GroupedSection(
              indent: 64,
              children: [
                for (final a in actions)
                  NavRow(
                    icon: a.icon,
                    color: a.color,
                    title: a.title,
                    subtitle: a.description,
                    onTap: a.onTap,
                    trailing: a.external
                        ? const Icon(CupertinoIcons.arrow_up_right_square, size: 17, color: AppColors.textFaint)
                        : null,
                  ),
              ],
            ),
          ],
        );

    return Scaffold(
      body: AppRefresh(
        onRefresh: () => context.read<SessionController>().refreshProfile(),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: _Hero(
                user: user,
                uploading: _avatarUploading,
                onAvatarTap: _changeAvatar,
                onEdit: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const EditProfileScreen())),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              sliver: SliverToBoxAdapter(
                child: SurfaceCard(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: IntrinsicHeight(
                    child: Row(
                      children: [
                        _Stat(icon: CupertinoIcons.heart_fill, value: '$favoritesCount', label: 'Favoris', color: AppColors.rose),
                        const VerticalDivider(width: 1, color: AppColors.border),
                        _Stat(icon: CupertinoIcons.book_fill, value: '$consulted', label: 'Consultées'),
                        const VerticalDivider(width: 1, color: AppColors.border),
                        _Stat(icon: CupertinoIcons.search, value: '$searches', label: 'Recherches', color: AppColors.successDark),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              sliver: SliverList.list(
                children: [
                  group('Bibliothèque', library),
                  const _GroupLabel('Informations personnelles'),
                  _InfoList(user: user),
                  group('Compte', account),
                  group('Plateformes BNN', platforms),
                ],
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 24, 16, 32),
              sliver: SliverToBoxAdapter(
                child: GroupedSection(
                  children: [
                    NavRow(
                      icon: CupertinoIcons.square_arrow_right,
                      title: 'Déconnexion',
                      destructive: true,
                      onTap: _logout,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GroupLabel extends StatelessWidget {
  const _GroupLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 22, 4, 8),
      child: Text(
        text.toUpperCase(),
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.6,
          color: AppColors.textMuted,
        ),
      ),
    );
  }
}

class _QuickAction {
  const _QuickAction(this.icon, this.title, this.description, this.onTap,
      {this.color = AppColors.primary, this.external = false});

  final IconData icon;
  final String title;
  final String description;
  final VoidCallback onTap;
  final Color color;
  final bool external;
}

class _Hero extends StatelessWidget {
  const _Hero({required this.user, required this.uploading, required this.onAvatarTap, required this.onEdit});

  final AppUser user;
  final bool uploading;
  final VoidCallback onAvatarTap;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Container(
        color: AppColors.navy,
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 10, 12, 24),
            child: Column(
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Profil',
                        style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w700, letterSpacing: -0.5),
                      ),
                    ),
                    HeaderIconButton(icon: CupertinoIcons.pencil, tooltip: 'Modifier le profil', onPressed: onEdit),
                  ],
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Semantics(
                      button: true,
                      label: 'Modifier la photo de profil',
                      child: GestureDetector(
                        onTap: uploading ? null : onAvatarTap,
                        child: Stack(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(3),
                              decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                              child: UserAvatar(initial: user.initial, url: user.avatarUrl, size: 78),
                            ),
                            Positioned(
                              right: 0,
                              bottom: 0,
                              child: Container(
                                width: 28,
                                height: 28,
                                decoration: BoxDecoration(
                                  color: AppColors.cyan,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: AppColors.navy, width: 2),
                                ),
                                child: uploading
                                    ? const CupertinoActivityIndicator(color: AppColors.deep, radius: 7)
                                    : const Icon(CupertinoIcons.camera_fill, size: 13, color: AppColors.deep),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            user.displayName,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700, letterSpacing: -0.3),
                          ),
                          if (user.handle.isNotEmpty)
                            Text(user.handle, style: const TextStyle(color: AppColors.onNavyMuted, fontSize: 14)),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: [
                              _HeroBadge(icon: CupertinoIcons.checkmark_seal_fill, label: user.roleLabel),
                              const _HeroBadge(icon: CupertinoIcons.circle_fill, label: 'En ligne', color: AppColors.success),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(color: AppColors.onNavySoft, borderRadius: BorderRadius.circular(12)),
                  child: Row(
                    children: [
                      const Icon(CupertinoIcons.building_2_fill, size: 15, color: AppColors.cyan),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          [
                            user.faculte ?? user.universite ?? 'Université non renseignée',
                            'Inscrit le ${formatLongDate(user.joinDate, fallback: '—')}',
                          ].join(' · '),
                          style: const TextStyle(color: Colors.white, fontSize: 12.5),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _HeroBadge extends StatelessWidget {
  const _HeroBadge({required this.icon, required this.label, this.color = AppColors.cyan});

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(color: AppColors.onNavySoft, borderRadius: BorderRadius.circular(99)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: icon == CupertinoIcons.circle_fill ? 8 : 13, color: color),
          const SizedBox(width: 5),
          Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 12)),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.icon, required this.value, required this.label, this.color = AppColors.primary});

  final IconData icon;
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
          Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
        ],
      ),
    );
  }
}

class _InfoList extends StatelessWidget {
  const _InfoList({required this.user});

  final AppUser user;

  @override
  Widget build(BuildContext context) {
    final rows = <(IconData, String, String)>[
      (CupertinoIcons.person, 'Nom complet', user.displayName),
      (CupertinoIcons.envelope, 'Email', user.email ?? 'Non renseigné'),
      (CupertinoIcons.phone, 'Téléphone', user.telephone ?? 'Non renseigné'),
      (CupertinoIcons.person_2, 'Sexe', user.sexe ?? 'Non renseigné'),
      (CupertinoIcons.location, 'Province', user.province ?? 'Non renseignée'),
      (CupertinoIcons.creditcard, 'Matricule', user.matricule ?? 'Non renseigné'),
      (CupertinoIcons.building_2_fill, 'Université', user.universite ?? 'Non renseignée'),
      (CupertinoIcons.book, 'Faculté', user.faculte ?? 'Non renseignée'),
      (CupertinoIcons.checkmark_shield, 'Rôle', user.roleLabel),
      (CupertinoIcons.calendar, "Date d'inscription", formatLongDate(user.joinDate, fallback: 'Non renseignée')),
    ];
    return GroupedSection(
      indent: 64,
      children: [
        for (final (icon, label, value) in rows) InfoRow(icon: icon, label: label, value: value),
      ],
    );
  }
}
