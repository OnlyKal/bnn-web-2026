import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/json_utils.dart';
import '../../../data/models/history_item.dart';
import '../../../data/models/ressource.dart';
import '../../../state/history_controller.dart';
import '../../../state/session_controller.dart';
import '../../../state/shell_controller.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';
import '../../widgets/states.dart';
import '../resource/resource_navigation.dart';
import '../stats/statistics_screen.dart';

const _filters = [
  ('all', 'Tout'),
  (HistoryType.resource, 'Ressources'),
  (HistoryType.favorite, 'Favoris'),
  (HistoryType.salon, 'Salons'),
  (HistoryType.search, 'Recherches'),
  (HistoryType.page, 'Pages'),
  (HistoryType.other, 'Autres'),
];

(IconData, Color) _visual(String type) => switch (type) {
      HistoryType.resource => (CupertinoIcons.book_fill, AppColors.primary),
      HistoryType.favorite => (CupertinoIcons.heart_fill, AppColors.rose),
      HistoryType.salon => (CupertinoIcons.chat_bubble_2_fill, AppColors.violet),
      HistoryType.search => (CupertinoIcons.search, AppColors.successDark),
      HistoryType.page => (CupertinoIcons.square_arrow_right, AppColors.navy),
      HistoryType.action => (CupertinoIcons.sparkles, AppColors.warning),
      _ => (CupertinoIcons.clock_fill, AppColors.textMuted),
    };

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  final _search = TextEditingController();
  String _query = '';
  String _filter = 'all';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<HistoryItem> _visible(List<HistoryItem> items) {
    final q = _query.trim().toLowerCase();
    return items.where((item) {
      final typeOk = _filter == 'all' ||
          item.type == _filter ||
          (_filter == HistoryType.other && item.type == HistoryType.action);
      final queryOk = q.isEmpty ||
          '${item.title} ${item.description} ${HistoryType.label(item.type)}'.toLowerCase().contains(q);
      return typeOk && queryOk;
    }).toList();
  }

  bool _canOpen(HistoryItem item) {
    final target = item.target;
    if (target == null) return false;
    if (target == HistoryTarget.resource) return asJson(item.metadata['resource']) != null;
    if (target == HistoryTarget.statistics) {
      return context.read<SessionController>().user?.isAdmin ?? false;
    }
    return true;
  }

  void _open(HistoryItem item) {
    final shell = context.read<ShellController>();
    switch (item.target) {
      case HistoryTarget.resource:
        final json = asJson(item.metadata['resource']);
        if (json != null) openRessourceDetails(context, Ressource.fromJson(json));
      case HistoryTarget.home:
        shell.goTo(AppTab.home);
      case HistoryTarget.favorites:
        shell.goTo(AppTab.favorites);
      case HistoryTarget.salons:
        shell.goTo(AppTab.salons);
      case HistoryTarget.profile:
        shell.goTo(AppTab.profile);
      case HistoryTarget.homeSearch:
        final query = item.metadata['query']?.toString();
        if (query != null) shell.openHomeSearch(query);
      case HistoryTarget.statistics:
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => const StatisticsScreen()));
      default:
        break;
    }
  }

  Future<void> _clearAll() async {
    final ok = await confirmAction(
      context,
      title: "Vider tout l'historique ?",
      message: 'Cette action supprime uniquement les données locales de cet appareil.',
      confirmLabel: 'Tout supprimer',
      destructive: true,
      icon: CupertinoIcons.trash,
    );
    if (ok && mounted) {
      context.read<HistoryController>().clear();
      showSuccess(context, 'Historique vidé');
    }
  }

  @override
  Widget build(BuildContext context) {
    final history = context.watch<HistoryController>();
    final all = history.items;
    final items = _visible(all);

    return Scaffold(
      body: Column(
        children: [
          TabHeader(
            eyebrow: 'Local et privé',
            title: 'Historique',
            subtitle: 'Vos dernières activités restent uniquement sur cet appareil.',
            actions: [
              if (all.isNotEmpty)
                HeaderIconButton(
                  icon: CupertinoIcons.trash,
                  tooltip: "Vider l'historique",
                  onPressed: _clearAll,
                ),
            ],
            bottom: SearchField(
              controller: _search,
              hint: 'Rechercher une activité…',
              onChanged: (v) => setState(() => _query = v),
              onDark: true,
            ),
          ),
          Expanded(
            child: CustomScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              slivers: [
                SliverToBoxAdapter(
                  child: ChipBar(
                    height: 58,
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
                    itemCount: _filters.length,
                    itemBuilder: (context, index) {
                      final (value, label) = _filters[index];
                      return ChoiceChip(
                        label: Text(label),
                        selected: _filter == value,
                        onSelected: (_) => setState(() => _filter = value),
                      );
                    },
                  ),
                ),
                if (items.isEmpty)
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: StatusView(
                      icon: CupertinoIcons.clock,
                      title: 'Aucun historique',
                      message: all.isEmpty
                          ? 'Vos prochaines activités apparaîtront ici.'
                          : 'Aucun élément ne correspond à ce filtre.',
                    ),
                  )
                else ...[
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 10, 20, 8),
                    sliver: SliverToBoxAdapter(
                      child: Text(
                        '${items.length} ${plural(items.length, 'activité')} · Glissez vers la gauche pour supprimer',
                        style: const TextStyle(color: AppColors.textMuted, fontSize: 12.5),
                      ),
                    ),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                    sliver: SliverList.separated(
                      itemCount: items.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final item = items[index];
                        return _HistoryTile(
                          item: item,
                          canOpen: _canOpen(item),
                          onOpen: () => _open(item),
                          onRemove: () => history.remove(item.id),
                        );
                      },
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.item, required this.canOpen, required this.onOpen, required this.onRemove});

  final HistoryItem item;
  final bool canOpen;
  final VoidCallback onOpen;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final (icon, color) = _visual(item.type);
    return Dismissible(
      key: ValueKey(item.id),
      direction: DismissDirection.endToStart,
      onDismissed: (_) => onRemove(),
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 22),
        decoration: BoxDecoration(
          color: AppColors.danger,
          borderRadius: BorderRadius.circular(14),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(CupertinoIcons.trash, color: Colors.white, size: 20),
            SizedBox(width: 6),
            Text('Supprimer', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
      child: SurfaceCard(
        onTap: canOpen ? onOpen : null,
        padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
        child: Row(
          children: [
            IconTile(icon, color: color, size: 42, iconSize: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5)),
                  const SizedBox(height: 2),
                  Text(
                    item.description.isEmpty ? 'Activité enregistrée localement' : item.description,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 12.5),
                  ),
                  const SizedBox(height: 5),
                  Row(
                    children: [
                      Pill(HistoryType.label(item.type), color: color),
                      const SizedBox(width: 6),
                      const Icon(CupertinoIcons.time, size: 12, color: AppColors.textFaint),
                      const SizedBox(width: 3),
                      Flexible(
                        child: Text(
                          formatRelativeTime(item.timestamp),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: AppColors.textFaint, fontSize: 11.5),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (canOpen)
              const Padding(
                padding: EdgeInsets.only(left: 4),
                child: Icon(CupertinoIcons.chevron_right, size: 15, color: AppColors.textFaint),
              ),
            IconButton(
              tooltip: 'Supprimer cet élément',
              onPressed: onRemove,
              icon: const Icon(CupertinoIcons.xmark, size: 16, color: AppColors.textFaint),
            ),
          ],
        ),
      ),
    );
  }
}
