import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../app_services.dart';
import '../../../core/config.dart';
import '../../../core/storage/local_store.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../state/session_controller.dart';
import '../../../state/shell_controller.dart';
import '../../widgets/common.dart';
import '../../widgets/external_links.dart';
import 'external_resources_view.dart';
import 'internal_resources_view.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  static const announcementKey = 'bnnSalonsAnnouncement:v1';
  static const tabKey = 'homepageActiveResourceTab';

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late bool _external = LocalStore.instance.getString(HomeScreen.tabKey) == 'external';
  late bool _externalVisited = _external;
  int? _internalCount;
  int? _externalCount;

  @override
  void initState() {
    super.initState();
    _loadExternalCount();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShowAnnouncement());
  }

  Future<void> _loadExternalCount() async {
    try {
      final total = await context.read<AppServices>().hal.totalCount();
      if (mounted) setState(() => _externalCount = total);
    } catch (_) {
      if (mounted) setState(() => _externalCount = 0);
    }
  }

  void _setExternal(bool value) {
    setState(() {
      _external = value;
      _externalVisited = _externalVisited || value;
    });
    LocalStore.instance.setString(HomeScreen.tabKey, value ? 'external' : 'internal');
  }

  Future<void> _maybeShowAnnouncement() async {
    final store = LocalStore.instance;
    if (store.getString(HomeScreen.announcementKey) == 'dismissed' || !mounted) return;
    final openSalons = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => const _SalonsAnnouncement(),
    );
    await store.setString(HomeScreen.announcementKey, 'dismissed');
    if (openSalons == true && mounted) context.read<ShellController>().goTo(AppTab.salons);
  }

  void _showPlatforms() {
    showModalBottomSheet<void>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SheetHeader(
              title: 'Plateformes BNN',
              subtitle: 'Les autres services de la BNN-ESURSI',
              icon: CupertinoIcons.square_grid_2x2,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
              child: GroupedSection(
                children: [
                  NavRow(
                    icon: CupertinoIcons.person_3_fill,
                    title: 'Classroom',
                    subtitle: 'Plateforme de cours en ligne',
                    trailing: const Icon(CupertinoIcons.arrow_up_right_square, size: 18, color: AppColors.textFaint),
                    onTap: () {
                      Navigator.of(sheetContext).pop();
                      openExternalUrl(context, AppConfig.classroomUrl);
                    },
                  ),
                  NavRow(
                    icon: CupertinoIcons.globe,
                    color: AppColors.navy,
                    title: 'Portail',
                    subtitle: 'Portail de la BNN-ESURSI',
                    trailing: const Icon(CupertinoIcons.arrow_up_right_square, size: 18, color: AppColors.textFaint),
                    onTap: () {
                      Navigator.of(sheetContext).pop();
                      openExternalUrl(context, AppConfig.portailUrl);
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = context.select<SessionController, String>((s) => s.user?.prenom ?? s.user?.displayName ?? '');
    final intro = _HomeIntro(
      name: user,
      internalCount: _internalCount,
      externalCount: _externalCount,
    );

    return Scaffold(
      body: Column(
        children: [
          TabHeader(
            leading: const Padding(
              padding: EdgeInsets.symmetric(vertical: 4),
              child: BnnLogo(height: 32),
            ),
            actions: [
              HeaderIconButton(
                icon: CupertinoIcons.square_grid_2x2,
                tooltip: 'Plateformes BNN',
                onPressed: _showPlatforms,
              ),
            ],
            bottom: Segmented<bool>(
              onDark: true,
              value: _external,
              onChanged: _setExternal,
              options: const [
                SegmentOption(false, 'Ressources internes', icon: CupertinoIcons.book),
                SegmentOption(true, 'Ressources externes', icon: CupertinoIcons.globe),
              ],
            ),
          ),
          Expanded(
            child: IndexedStack(
              index: _external ? 1 : 0,
              children: [
                InternalResourcesView(
                  intro: intro,
                  onTotalCount: (count) {
                    if (mounted && count != _internalCount) setState(() => _internalCount = count);
                  },
                ),
                _externalVisited ? ExternalResourcesView(intro: intro) : const SizedBox.shrink(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Salutation et chiffres clés du fonds documentaire.
class _HomeIntro extends StatelessWidget {
  const _HomeIntro({required this.name, required this.internalCount, required this.externalCount});

  final String name;
  final int? internalCount;
  final int? externalCount;

  String _label(int? value) => value == null ? '…' : formatNumber(value);

  @override
  Widget build(BuildContext context) {
    final combined = internalCount != null && externalCount != null
        ? formatNumber(internalCount! + externalCount!)
        : '…';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          name.isEmpty ? 'Bienvenue' : 'Bonjour $name',
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, letterSpacing: -0.4),
        ),
        const SizedBox(height: 2),
        Text(
          '${formatToday(DateTime.now())} · Que souhaitez-vous consulter ?',
          style: const TextStyle(color: AppColors.textMuted, fontSize: 13),
        ),
        const SizedBox(height: 14),
        Semantics(
          label: 'La BNN-ESURSI référence $combined ressources : '
              '${_label(internalCount)} internes et ${_label(externalCount)} externes.',
          excludeSemantics: true,
          child: SurfaceCard(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: IntrinsicHeight(
              child: Row(
                children: [
                  _Stat(value: combined, label: 'Ressources', icon: CupertinoIcons.collections, emphasis: true),
                  const VerticalDivider(width: 1, color: AppColors.border),
                  _Stat(value: _label(internalCount), label: 'Internes', icon: CupertinoIcons.book),
                  const VerticalDivider(width: 1, color: AppColors.border),
                  _Stat(value: _label(externalCount), label: 'Externes (HAL)', icon: CupertinoIcons.globe),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label, required this.icon, this.emphasis = false});

  final String value;
  final String label;
  final IconData icon;
  final bool emphasis;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 17, color: emphasis ? AppColors.primary : AppColors.textFaint),
            const SizedBox(height: 6),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                value,
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.3,
                  color: emphasis ? AppColors.primary : AppColors.textPrimary,
                ),
              ),
            ),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 11.5, color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}

class _SalonsAnnouncement extends StatelessWidget {
  const _SalonsAnnouncement();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Center(
              child: IconTile(CupertinoIcons.chat_bubble_2_fill, size: 64, iconSize: 30, solid: true, radius: 20),
            ),
            const SizedBox(height: 18),
            const Text(
              '🎉 Découvrez les nouveaux Salons BNN',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, letterSpacing: -0.3),
            ),
            const SizedBox(height: 12),
            const Text(
              'La BNN met à votre disposition des salons de discussion thématiques pour échanger '
              'autour de sujets spécifiques, partager des connaissances et consulter des ressources '
              'utiles : livres, documents PDF, images, liens et autres contenus éducatifs.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary, height: 1.5),
            ),
            const SizedBox(height: 8),
            const Text(
              'Rejoignez les discussions qui vous intéressent et enrichissez vos connaissances avec la communauté.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textMuted, height: 1.5),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: () => Navigator.of(context).pop(true),
              icon: const Icon(CupertinoIcons.chat_bubble_2, size: 20),
              label: const Text('Voir les Salons'),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Fermer'),
            ),
          ],
        ),
      ),
    );
  }
}
