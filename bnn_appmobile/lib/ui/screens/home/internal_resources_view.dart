import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../app_services.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/history_item.dart';
import '../../../data/models/ressource.dart';
import '../../../state/history_controller.dart';
import '../../../state/internal_resources_controller.dart';
import '../../../state/shell_controller.dart';
import '../../widgets/common.dart';
import '../../widgets/resource_card.dart';
import '../../widgets/states.dart';
import '../resource/resource_navigation.dart';

class InternalResourcesView extends StatefulWidget {
  const InternalResourcesView({super.key, this.onTotalCount, this.intro});

  final ValueChanged<int>? onTotalCount;

  /// Bloc d'accueil affiché en tête de liste (salutation, chiffres clés).
  final Widget? intro;

  @override
  State<InternalResourcesView> createState() => _InternalResourcesViewState();
}

class _InternalResourcesViewState extends State<InternalResourcesView>
    with AutomaticKeepAliveClientMixin {
  late final InternalResourcesController _controller;
  final _searchController = TextEditingController();
  final _searchFocus = FocusNode();
  final _scroll = ScrollController();
  ShellController? _shell;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _controller = InternalResourcesController(context.read<AppServices>().ressources)
      ..onSearchCommitted = (query) {
        context.read<HistoryController>().add(
              type: HistoryType.search,
              title: query,
              description: 'Recherche effectuée dans les ressources',
              target: HistoryTarget.homeSearch,
              metadata: {'query': query},
            );
      }
      ..addListener(_reportCount);
    _controller.init();
    _searchFocus.addListener(() => setState(() {}));
    _scroll.addListener(_onScroll);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final shell = context.read<ShellController>();
    if (_shell != shell) {
      _shell?.removeListener(_applyPendingSearch);
      _shell = shell..addListener(_applyPendingSearch);
      _applyPendingSearch();
    }
  }

  void _applyPendingSearch() {
    final query = _shell?.consumeHomeSearch();
    if (query == null) return;
    _searchController.text = query;
    _controller.setQuery(query);
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  void _reportCount() {
    if (_controller.countLoaded) widget.onTotalCount?.call(_controller.totalCount);
  }

  void _onScroll() {
    if (_scroll.position.extentAfter < 600 && _controller.canLoadMore) _controller.loadMore();
  }

  @override
  void dispose() {
    _shell?.removeListener(_applyPendingSearch);
    _controller.dispose();
    _searchController.dispose();
    _searchFocus.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _open(Ressource ressource) {
    _searchFocus.unfocus();
    openRessourceDetails(context, ressource, description: ressource.domaineNom ?? 'Ressource ouverte depuis l’accueil');
  }

  Future<void> _pickDomain() async {
    final selected = await showModalBottomSheet<Domaine?>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _DomainSheet(
        domaines: _controller.domaines,
        loading: _controller.loadingDomaines,
        selected: _controller.selectedDomain,
      ),
    );
    if (selected != null) _controller.selectDomain(selected);
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return ListenableBuilder(
      listenable: _controller,
      builder: (context, _) {
        final c = _controller;
        final items = c.visible;
        final busy = c.isSearchMode ? (c.searchLoading && items.isEmpty) : c.loading;
        final suggestions = _searchFocus.hasFocus ? c.suggestions : const <SearchSuggestion>[];
        final showRecent = !c.isSearchMode && c.selectedDomain == null && c.activeType == 'all' && c.recent.isNotEmpty;

        return AppRefresh(
          onRefresh: c.refresh,
          child: CustomScrollView(
            controller: _scroll,
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              if (widget.intro != null)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
                  sliver: SliverToBoxAdapter(child: widget.intro),
                ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
                sliver: SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SearchField(
                        controller: _searchController,
                        focusNode: _searchFocus,
                        hint: 'Titre, domaine, sous-domaine, auteur…',
                        onChanged: c.setQuery,
                        onClear: c.clearSearch,
                        onSubmitted: (_) => _searchFocus.unfocus(),
                      ),
                      if (suggestions.isNotEmpty) _Suggestions(
                        suggestions: suggestions,
                        onSelected: (s) {
                          _searchController.text = s.text;
                          c.setQuery(s.text);
                          _searchFocus.unfocus();
                        },
                      ),
                    ],
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: ChipBar(
                  height: 56,
                  itemCount: c.typeCounts.length,
                  itemBuilder: (context, index) {
                    final t = c.typeCounts[index];
                    final selected = c.activeType == t.type;
                    return ChoiceChip(
                      avatar: Icon(
                        typeIcon(t.type),
                        size: 16,
                        color: selected ? Colors.white : AppColors.primary,
                      ),
                      label: Text('${t.label} (${formatNumber(t.count)})'),
                      selected: selected,
                      onSelected: (_) => c.selectType(t.type),
                    );
                  },
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
                sliver: SliverToBoxAdapter(
                  child: _DomainFilter(
                    domain: c.selectedDomain,
                    enabled: !c.isSearchMode,
                    onPick: _pickDomain,
                    onClear: () => c.selectDomain(null),
                  ),
                ),
              ),
              if (showRecent) ...[
                const SliverPadding(
                  padding: EdgeInsets.fromLTRB(16, 26, 16, 12),
                  sliver: SliverToBoxAdapter(
                    child: SectionHeader(
                      title: 'Ajouts récents',
                      subtitle: 'Les 5 dernières ressources',
                      icon: CupertinoIcons.sparkles,
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 226,
                    child: ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      scrollDirection: Axis.horizontal,
                      itemCount: c.recent.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 14),
                      itemBuilder: (context, index) => _RecentCard(
                        ressource: c.recent[index],
                        onTap: () => _open(c.recent[index]),
                      ),
                    ),
                  ),
                ),
              ],
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 22, 16, 12),
                sliver: SliverToBoxAdapter(
                  child: SectionHeader(
                    icon: c.isSearchMode ? CupertinoIcons.search : CupertinoIcons.book,
                    title: c.isSearchMode
                        ? 'Résultats de recherche'
                        : (c.selectedDomain != null ? c.selectedDomain!.nom : 'Ressources disponibles'),
                    subtitle: busy
                        ? 'Chargement…'
                        : c.isSearchMode
                            ? '${formatNumber(items.length)} affichés sur ${formatNumber(c.searchTotal)}'
                            : '${formatNumber(items.length)} ${plural(items.length, 'ressource')}'
                                '${c.activeType != 'all' ? ' · ${ResourceTypes.label(c.activeType)}' : ''}',
                    trailing: c.isSearchMode
                        ? TextButton.icon(
                            onPressed: () {
                              _searchController.clear();
                              c.clearSearch();
                            },
                            icon: const Icon(CupertinoIcons.xmark, size: 15),
                            label: const Text('Effacer'),
                          )
                        : (c.activeType != 'all'
                            ? TextButton(onPressed: () => c.selectType('all'), child: const Text('Tout voir'))
                            : null),
                  ),
                ),
              ),
              if (busy)
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverList.separated(
                    itemCount: 5,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, _) => const ResourceTileSkeleton(),
                  ),
                )
              else if ((c.isSearchMode ? c.searchError : c.error) != null && items.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: StatusView.error(
                    message: c.isSearchMode ? c.searchError : c.error,
                    onAction: c.refresh,
                  ),
                )
              else if (items.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: StatusView(
                    icon: c.isSearchMode ? CupertinoIcons.search : CupertinoIcons.book,
                    title: c.isSearchMode
                        ? 'Aucune ressource trouvée'
                        : c.selectedDomain != null
                            ? 'Aucune ressource dans « ${c.selectedDomain!.nom} »'
                            : 'Aucune ressource disponible',
                    message: c.isSearchMode
                        ? 'Essayez de modifier vos critères de recherche.'
                        : c.selectedDomain != null
                            ? 'Sélectionnez un autre domaine ou effacez le filtre.'
                            : 'Les ressources seront bientôt disponibles.',
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverList.separated(
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) => ResourceCard(
                      ressource: items[index],
                      onTap: () => _open(items[index]),
                    ),
                  ),
                ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                  child: (c.loadingMore || (c.isSearchMode && c.searchLoading && items.isNotEmpty))
                      ? const Center(child: CupertinoActivityIndicator())
                      : (c.canLoadMore && items.isNotEmpty)
                          ? OutlinedButton.icon(
                              onPressed: c.loadMore,
                              icon: const Icon(CupertinoIcons.chevron_down, size: 16),
                              label: const Text('Charger plus'),
                            )
                          : const SizedBox.shrink(),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Sélecteur de domaine présenté comme un champ (ouvre une feuille de choix).
class _DomainFilter extends StatelessWidget {
  const _DomainFilter({required this.domain, required this.enabled, required this.onPick, required this.onClear});

  final Domaine? domain;
  final bool enabled;
  final VoidCallback onPick;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final active = domain != null;
    return Row(
      children: [
        Expanded(
          child: Opacity(
            opacity: enabled ? 1 : 0.5,
            child: SurfaceCard(
              onTap: enabled ? onPick : null,
              radius: 12,
              borderColor: active ? AppColors.primary : AppColors.border,
              color: active ? AppColors.primarySoft : AppColors.surface,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Icon(CupertinoIcons.folder, size: 18, color: active ? AppColors.primary : AppColors.textMuted),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Domaine', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                        Text(
                          domain?.nom ?? 'Tous les domaines',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: active ? AppColors.primary : AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(CupertinoIcons.chevron_down, size: 15, color: AppColors.textFaint),
                ],
              ),
            ),
          ),
        ),
        if (active) ...[
          const SizedBox(width: 8),
          IconButton(
            tooltip: 'Effacer le filtre',
            onPressed: onClear,
            style: IconButton.styleFrom(
              backgroundColor: AppColors.surface,
              side: const BorderSide(color: AppColors.border),
              minimumSize: const Size(50, 50),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            icon: const Icon(CupertinoIcons.xmark, size: 18, color: AppColors.textSecondary),
          ),
        ],
      ],
    );
  }
}

class _Suggestions extends StatelessWidget {
  const _Suggestions({required this.suggestions, required this.onSelected});

  final List<SearchSuggestion> suggestions;
  final ValueChanged<SearchSuggestion> onSelected;

  IconData _icon(String kind) => switch (kind) {
        'titre' => CupertinoIcons.doc_text,
        'sous_titre' => CupertinoIcons.text_alignleft,
        'domaine' => CupertinoIcons.folder,
        _ => CupertinoIcons.tag,
      };

  @override
  Widget build(BuildContext context) {
    return SurfaceCard(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.only(bottom: 4),
      radius: 12,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Row(
              children: [
                const Icon(CupertinoIcons.lightbulb, size: 15, color: AppColors.warning),
                const SizedBox(width: 6),
                Text('Suggestions (${suggestions.length})',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5, color: AppColors.textMuted)),
              ],
            ),
          ),
          for (final s in suggestions)
            ListTile(
              dense: true,
              visualDensity: VisualDensity.compact,
              leading: Icon(_icon(s.kind), size: 18, color: AppColors.primary),
              title: Text(s.text, maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
              trailing: Text(s.kindLabel, style: const TextStyle(fontSize: 11.5, color: AppColors.textFaint)),
              onTap: () => onSelected(s),
            ),
        ],
      ),
    );
  }
}

/// Vignette « couverture de livre » des ajouts récents.
class _RecentCard extends StatelessWidget {
  const _RecentCard({required this.ressource, required this.onTap});

  final Ressource ressource;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 118,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ResourceCover(ressource: ressource, width: 118, height: 158, radius: 10),
            const SizedBox(height: 8),
            // Le texte s'adapte à la place restante (grandes polices d'accessibilité).
            Flexible(
              child: Text(
                ressource.titre,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, height: 1.25),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              formatShortDate(ressource.datePublication),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.textMuted, fontSize: 11.5),
            ),
          ],
        ),
      ),
    );
  }
}

class _DomainSheet extends StatefulWidget {
  const _DomainSheet({required this.domaines, required this.loading, required this.selected});

  final List<Domaine> domaines;
  final bool loading;
  final Domaine? selected;

  @override
  State<_DomainSheet> createState() => _DomainSheetState();
}

class _DomainSheetState extends State<_DomainSheet> {
  final _search = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final q = _query.toLowerCase();
    final items = widget.domaines
        .where((d) => q.isEmpty || d.nom.toLowerCase().contains(q) || (d.description?.toLowerCase().contains(q) ?? false))
        .toList();
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      minChildSize: 0.4,
      builder: (context, scroll) => Column(
        children: [
          const SheetHeader(
            title: 'Domaines',
            subtitle: 'Filtrer les ressources par domaine',
            icon: CupertinoIcons.folder,
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: SearchField(
              controller: _search,
              hint: 'Rechercher un domaine…',
              onChanged: (v) => setState(() => _query = v),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: widget.loading
                ? const Center(child: CupertinoActivityIndicator())
                : items.isEmpty
                    ? StatusView(
                        icon: CupertinoIcons.folder,
                        title: widget.domaines.isEmpty ? 'Aucun domaine disponible' : 'Aucun domaine ne correspond',
                        compact: true,
                      )
                    : ListView.separated(
                        controller: scroll,
                        itemCount: items.length,
                        separatorBuilder: (_, _) => const Divider(indent: 20, endIndent: 20),
                        itemBuilder: (context, index) {
                          final d = items[index];
                          final selected = widget.selected?.id == d.id;
                          return ListTile(
                            selected: selected,
                            selectedTileColor: AppColors.primarySoft,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 20),
                            title: Text(d.nom,
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  color: selected ? AppColors.primary : AppColors.textPrimary,
                                )),
                            subtitle: d.description == null
                                ? null
                                : Text(d.description!, maxLines: 2, overflow: TextOverflow.ellipsis),
                            trailing: selected
                                ? const Icon(CupertinoIcons.checkmark_alt, color: AppColors.primary)
                                : null,
                            onTap: () => Navigator.of(context).pop(d),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
