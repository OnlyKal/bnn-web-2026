import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/history_item.dart';
import '../../../data/models/ressource.dart';
import '../../../state/favorites_controller.dart';
import '../../../state/history_controller.dart';
import '../../../state/shell_controller.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';
import '../../widgets/resource_card.dart';
import '../../widgets/states.dart';
import '../resource/resource_navigation.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  final _search = TextEditingController();
  String _query = '';
  Timer? _historyTimer;

  @override
  void dispose() {
    _historyTimer?.cancel();
    _search.dispose();
    super.dispose();
  }

  void _onQuery(String value) {
    setState(() => _query = value);
    _historyTimer?.cancel();
    final query = value.trim();
    if (query.length < 2) return;
    _historyTimer = Timer(const Duration(milliseconds: 600), () {
      context.read<HistoryController>().add(
            type: HistoryType.search,
            title: query,
            description: 'Recherche effectuée dans les favoris',
            target: HistoryTarget.favorites,
            metadata: {'query': 'favoris:$query'},
          );
    });
  }

  List<Ressource> _filter(List<Ressource> all) {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return all;
    return all.where((r) {
      return [r.titre, r.sousTitre, r.type, r.format, r.domaineNom, r.auteurs, r.description]
          .whereType<String>()
          .join(' ')
          .toLowerCase()
          .contains(q);
    }).toList();
  }

  Future<void> _remove(Ressource r) async {
    final confirmed = await confirmAction(
      context,
      title: 'Retirer ce favori ?',
      message: 'Vous allez retirer « ${r.titre} » de vos favoris.',
      confirmLabel: 'Retirer',
      destructive: true,
      icon: CupertinoIcons.heart_slash,
    );
    if (!confirmed || !mounted) return;
    try {
      await context.read<FavoritesController>().remove(r);
      if (!mounted) return;
      context.read<HistoryController>().addResource(
            r,
            type: HistoryType.favorite,
            action: 'removed',
            description: 'Ressource retirée des favoris',
          );
      showSuccess(context, '« ${r.titre} » retiré des favoris');
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final favorites = context.watch<FavoritesController>();
    final all = favorites.all;
    final items = _filter(all);
    final loading = favorites.status == FavoritesStatus.loading && all.isEmpty;

    return Scaffold(
      body: Column(
        children: [
          TabHeader(
            eyebrow: 'Bibliothèque personnelle',
            title: 'Favoris',
            subtitle: 'Retrouvez rapidement les ressources que vous avez mises de côté pour votre travail.',
            bottom: all.isEmpty
                ? null
                : SearchField(controller: _search, hint: 'Titre, domaine, type…', onChanged: _onQuery, onDark: true),
          ),
          Expanded(
            child: AppRefresh(
              onRefresh: favorites.refresh,
              child: CustomScrollView(
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  if (all.isNotEmpty)
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
                      sliver: SliverToBoxAdapter(
                        child: SectionHeader(
                          icon: CupertinoIcons.heart_fill,
                          title: _query.isEmpty ? 'Ma sélection' : 'Résultats',
                          subtitle: _query.isEmpty
                              ? '${all.length} ${plural(all.length, 'favori')}'
                              : '${items.length} ${plural(items.length, 'résultat')}',
                        ),
                      ),
                    ),
                  if (loading)
                    SliverPadding(
                      padding: const EdgeInsets.all(16),
                      sliver: SliverList.separated(
                        itemCount: 4,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (_, _) => const ResourceTileSkeleton(),
                      ),
                    )
                  else if (favorites.status == FavoritesStatus.error && all.isEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: StatusView.error(
                        title: 'Erreur de chargement',
                        message: "Impossible d'afficher vos favoris pour le moment.",
                        onAction: favorites.refresh,
                      ),
                    )
                  else if (all.isEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: StatusView(
                        icon: CupertinoIcons.heart,
                        title: 'Aucun favori pour le moment',
                        message: 'Explorez les ressources et ajoutez-les à vos favoris en touchant le cœur.',
                        actionLabel: 'Parcourir les ressources',
                        onAction: () => context.read<ShellController>().goTo(AppTab.home),
                      ),
                    )
                  else if (items.isEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: StatusView(
                        icon: CupertinoIcons.search,
                        title: 'Aucun résultat',
                        message: 'Aucun favori ne correspond à « $_query ». Essayez un autre mot-clé.',
                        actionLabel: 'Effacer la recherche',
                        onAction: () {
                          _search.clear();
                          _onQuery('');
                        },
                      ),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                      sliver: SliverList.separated(
                        itemCount: items.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final r = items[index];
                          final pending = favorites.isPending(r);
                          return ResourceCard(
                            ressource: r,
                            onTap: () => openRessourceDetails(context, r, description: 'Ouverte depuis les favoris'),
                            trailing: pending
                                ? const Padding(
                                    padding: EdgeInsets.all(12),
                                    child: CupertinoActivityIndicator(),
                                  )
                                : IconButton(
                                    tooltip: 'Retirer des favoris',
                                    onPressed: () => _remove(r),
                                    icon: const Icon(CupertinoIcons.heart_fill, color: AppColors.rose, size: 22),
                                  ),
                          );
                        },
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
