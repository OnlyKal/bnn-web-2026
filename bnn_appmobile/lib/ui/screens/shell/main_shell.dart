import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../data/models/history_item.dart';
import '../../../state/favorites_controller.dart';
import '../../../state/history_controller.dart';
import '../../../state/session_controller.dart';
import '../../../state/shell_controller.dart';
import '../favorites/favorites_screen.dart';
import '../history/history_screen.dart';
import '../home/home_screen.dart';
import '../profile/profile_screen.dart';
import '../salons/salons_screen.dart';

/// Navigation principale de l'application (barre inférieure à 5 onglets).
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  final ShellController _shell = ShellController();
  final Set<AppTab> _visited = {AppTab.home};

  static const _titles = {
    AppTab.home: 'Accueil',
    AppTab.favorites: 'Favoris',
    AppTab.salons: 'Salons',
    AppTab.history: 'Historique',
    AppTab.profile: 'Profil',
  };

  static const _targets = {
    AppTab.home: HistoryTarget.home,
    AppTab.favorites: HistoryTarget.favorites,
    AppTab.salons: HistoryTarget.salons,
    AppTab.history: HistoryTarget.history,
    AppTab.profile: HistoryTarget.profile,
  };

  @override
  void initState() {
    super.initState();
    _shell.addListener(_onTabChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final user = context.read<SessionController>().user;
      context.read<FavoritesController>().bindUser(user?.storageIdentity ?? 'anonymous');
      _logPage(AppTab.home);
    });
  }

  @override
  void dispose() {
    _shell.removeListener(_onTabChanged);
    _shell.dispose();
    super.dispose();
  }

  void _onTabChanged() {
    setState(() => _visited.add(_shell.tab));
    _logPage(_shell.tab);
    if (_shell.tab == AppTab.history) context.read<HistoryController>().markSeen();
  }

  void _logPage(AppTab tab) {
    final title = _titles[tab]!;
    context.read<HistoryController>().add(
          type: HistoryType.page,
          title: title,
          description: 'Page ouverte : $title',
          target: _targets[tab],
        );
  }

  Widget _buildTab(AppTab tab) => switch (tab) {
        AppTab.home => const HomeScreen(),
        AppTab.favorites => const FavoritesScreen(),
        AppTab.salons => const SalonsScreen(),
        AppTab.history => const HistoryScreen(),
        AppTab.profile => const ProfileScreen(),
      };

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<ShellController>.value(
      value: _shell,
      child: Consumer<ShellController>(
        builder: (context, shell, _) => PopScope(
          // Retour système : revenir à l'accueil avant de quitter l'application.
          canPop: shell.tab == AppTab.home,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop) shell.goTo(AppTab.home);
          },
          child: Scaffold(
            body: IndexedStack(
              index: shell.tab.index,
              children: [
                for (final tab in AppTab.values)
                  _visited.contains(tab) ? _buildTab(tab) : const SizedBox.shrink(),
              ],
            ),
            bottomNavigationBar: _BottomBar(shell: shell),
          ),
        ),
      ),
    );
  }
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.shell});

  final ShellController shell;

  @override
  Widget build(BuildContext context) {
    final favoritesCount = context.select<FavoritesController, int>((c) => c.count);
    final unseen = context.select<HistoryController, int>((c) => c.unseenCount);
    final showHistoryDot = shell.tab != AppTab.history && unseen > 0;

    Widget badged(IconData icon, {int count = 0, bool dot = false}) => Badge(
          isLabelVisible: count > 0 || dot,
          smallSize: 8,
          label: count > 0 ? Text(count > 99 ? '99+' : '$count') : null,
          child: Icon(icon),
        );

    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: NavigationBar(
        selectedIndex: shell.tab.index,
        onDestinationSelected: (index) => shell.goTo(AppTab.values[index]),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: [
          const NavigationDestination(
            icon: Icon(CupertinoIcons.book),
            selectedIcon: Icon(CupertinoIcons.book_fill),
            label: 'Accueil',
          ),
          NavigationDestination(
            icon: badged(CupertinoIcons.heart, count: favoritesCount),
            selectedIcon: badged(CupertinoIcons.heart_fill, count: favoritesCount),
            label: 'Favoris',
          ),
          const NavigationDestination(
            icon: Icon(CupertinoIcons.chat_bubble_2),
            selectedIcon: Icon(CupertinoIcons.chat_bubble_2_fill),
            label: 'Salons',
          ),
          NavigationDestination(
            icon: badged(CupertinoIcons.clock, dot: showHistoryDot),
            selectedIcon: const Icon(CupertinoIcons.clock_fill),
            label: 'Historique',
          ),
          const NavigationDestination(
            icon: Icon(CupertinoIcons.person_crop_circle),
            selectedIcon: Icon(CupertinoIcons.person_crop_circle_fill),
            label: 'Profil',
          ),
        ],
      ),
    );
  }
}
