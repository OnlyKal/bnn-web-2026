import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../app_services.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/history_item.dart';
import '../../../data/services/hal_service.dart';
import '../../../state/hal_resources_controller.dart';
import '../../../state/history_controller.dart';
import '../../widgets/common.dart';
import '../../widgets/resource_card.dart';
import '../../widgets/states.dart';
import '../resource/resource_navigation.dart';

const _languages = [('', 'Toutes les langues'), ('fr', 'Français'), ('en', 'Anglais')];

class ExternalResourcesView extends StatefulWidget {
  const ExternalResourcesView({super.key, this.intro});

  /// Bloc d'accueil affiché en tête de liste (salutation, chiffres clés).
  final Widget? intro;

  @override
  State<ExternalResourcesView> createState() => _ExternalResourcesViewState();
}

class _ExternalResourcesViewState extends State<ExternalResourcesView>
    with AutomaticKeepAliveClientMixin {
  late final HalResourcesController _controller =
      HalResourcesController(context.read<AppServices>().hal)..init();
  final _search = TextEditingController();
  final _scroll = ScrollController();

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.extentAfter < 500) _controller.loadMore();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _search.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _submitQuery(String value) {
    FocusScope.of(context).unfocus();
    final query = value.trim();
    if (query.length >= 2) {
      context.read<HistoryController>().add(
            type: HistoryType.search,
            title: query,
            description: 'Recherche effectuée dans HAL',
            metadata: {'query': 'hal:$query'},
          );
    }
    _controller.apply(_controller.filters.copyWith(q: query));
  }

  Future<void> _openFilters() async {
    final next = await showModalBottomSheet<HalFilters>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _HalFiltersSheet(controller: _controller),
    );
    if (next != null) _controller.apply(next);
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return ListenableBuilder(
      listenable: _controller,
      builder: (context, _) {
        final c = _controller;
        final f = c.filters;
        final activeChips = <(String, HalFilters)>[
          if (f.domain.isNotEmpty) (c.domainName(f.domain), f.copyWith(domain: '')),
          if (f.docType.isNotEmpty) (f.docType, f.copyWith(docType: '')),
          if (f.language.isNotEmpty)
            (_languages.firstWhere((l) => l.$1 == f.language, orElse: () => (f.language, f.language)).$2,
                f.copyWith(language: '')),
          if (f.author.isNotEmpty) ('Auteur : ${f.author}', f.copyWith(author: '')),
          if (f.title.isNotEmpty) ('Titre : ${f.title}', f.copyWith(title: '')),
          if (f.keywords.isNotEmpty) ('Mot-clé : ${f.keywords}', f.copyWith(keywords: '')),
          if (f.year.isNotEmpty) ('Année : ${f.year}', f.copyWith(year: '')),
          if (!f.hasFile) ('Sans fichier inclus', f.copyWith(hasFile: true)),
        ];
        final filterCount = activeChips.length;

        return AppRefresh(
          onRefresh: c.retry,
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
                  child: Row(
                    children: [
                      Expanded(
                        child: SearchField(
                          controller: _search,
                          hint: 'Rechercher une ressource HAL…',
                          onSubmitted: _submitQuery,
                          onClear: () => _submitQuery(''),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton.filled(
                        tooltip: 'Filtres',
                        style: IconButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          minimumSize: const Size(48, 48),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: _openFilters,
                        icon: Badge.count(
                          count: filterCount,
                          isLabelVisible: filterCount > 0,
                          backgroundColor: AppColors.cyan,
                          textColor: AppColors.deep,
                          child: const Icon(CupertinoIcons.slider_horizontal_3, size: 20, color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (activeChips.isNotEmpty)
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 50,
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                      scrollDirection: Axis.horizontal,
                      itemCount: activeChips.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 8),
                      itemBuilder: (context, index) {
                        final (label, without) = activeChips[index];
                        return InputChip(
                          label: Text(label),
                          backgroundColor: AppColors.primarySoft,
                          side: const BorderSide(color: AppColors.primaryTint),
                          labelStyle: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primary,
                          ),
                          deleteIcon: const Icon(CupertinoIcons.xmark, size: 14, color: AppColors.primary),
                          onDeleted: () => c.apply(without),
                          deleteButtonTooltipMessage: 'Retirer ce filtre',
                        );
                      },
                    ),
                  ),
                ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 22, 16, 12),
                sliver: SliverToBoxAdapter(
                  child: SectionHeader(
                    title: 'Ressources HAL',
                    subtitle: c.loading
                        ? 'Recherche…'
                        : '${formatNumber(c.total)} ${plural(c.total, 'résultat')} · Source : HAL',
                    icon: CupertinoIcons.globe,
                  ),
                ),
              ),
              if (c.loading)
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverList.separated(
                    itemCount: 5,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, _) => const ResourceTileSkeleton(),
                  ),
                )
              else if (c.error != null && c.items.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: StatusView.error(message: c.error, onAction: c.retry),
                )
              else if (c.items.isEmpty)
                const SliverFillRemaining(
                  hasScrollBody: false,
                  child: StatusView(
                    icon: CupertinoIcons.search,
                    title: 'Aucune ressource trouvée',
                    message: 'Aucune ressource HAL ne correspond à ces critères. Modifiez votre recherche ou vos filtres.',
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverList.separated(
                    itemCount: c.items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final r = c.items[index];
                      return ResourceCard(
                        ressource: r,
                        onTap: () => openRessourceDetails(context, r, description: 'Ressource HAL consultée'),
                      );
                    },
                  ),
                ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                  child: c.loadingMore
                      ? const Center(child: CupertinoActivityIndicator())
                      : (!c.loading && c.hasMore && c.items.isNotEmpty)
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

class _HalFiltersSheet extends StatefulWidget {
  const _HalFiltersSheet({required this.controller});

  final HalResourcesController controller;

  @override
  State<_HalFiltersSheet> createState() => _HalFiltersSheetState();
}

class _HalFiltersSheetState extends State<_HalFiltersSheet> {
  late HalFilters _draft = widget.controller.filters;
  late final _author = TextEditingController(text: _draft.author);
  late final _title = TextEditingController(text: _draft.title);
  late final _keywords = TextEditingController(text: _draft.keywords);
  late final _year = TextEditingController(text: _draft.year);
  final _domainSearch = TextEditingController();
  String _domainQuery = '';

  @override
  void dispose() {
    for (final c in [_author, _title, _keywords, _year, _domainSearch]) {
      c.dispose();
    }
    super.dispose();
  }

  HalFilters get _result => _draft.copyWith(
        author: _author.text.trim(),
        title: _title.text.trim(),
        keywords: _keywords.text.trim(),
        year: _year.text.trim(),
      );

  Widget _label(String text, IconData icon) => Padding(
        padding: const EdgeInsets.fromLTRB(0, 22, 0, 10),
        child: Row(
          children: [
            Icon(icon, size: 17, color: AppColors.primary),
            const SizedBox(width: 8),
            Text(text, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          ],
        ),
      );

  @override
  Widget build(BuildContext context) {
    final q = _domainQuery.toLowerCase();
    final domains = widget.controller.domaines
        .where((d) => q.isEmpty || '${d.name} ${d.label} ${d.code}'.toLowerCase().contains(q))
        .take(q.isEmpty ? 30 : 100)
        .toList();

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.9,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      builder: (context, scroll) => Column(
        children: [
          const SheetHeader(
            title: 'Filtres HAL',
            subtitle: 'Affinez les ressources externes',
            icon: CupertinoIcons.slider_horizontal_3,
          ),
          const Divider(),
          Expanded(
            child: ListView(
              controller: scroll,
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
              children: [
                _label('Langue', CupertinoIcons.textformat),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final (code, label) in _languages)
                      ChoiceChip(
                        label: Text(label),
                        selected: _draft.language == code,
                        onSelected: (_) => setState(() => _draft = _draft.copyWith(language: code)),
                      ),
                  ],
                ),
                _label('Type de document', CupertinoIcons.doc_text),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    ChoiceChip(
                      label: const Text('Tous les types'),
                      selected: _draft.docType.isEmpty,
                      onSelected: (_) => setState(() => _draft = _draft.copyWith(docType: '')),
                    ),
                    for (final type in HalDocumentType.all)
                      Tooltip(
                        message: type.label,
                        child: ChoiceChip(
                          label: Text('${type.code} · ${type.label}'),
                          selected: _draft.docType == type.code,
                          onSelected: (_) => setState(() => _draft = _draft.copyWith(docType: type.code)),
                        ),
                      ),
                  ],
                ),
                _label('Domaine', CupertinoIcons.folder),
                SearchField(
                  controller: _domainSearch,
                  hint: 'Rechercher un domaine…',
                  onChanged: (v) => setState(() => _domainQuery = v),
                ),
                const SizedBox(height: 8),
                if (widget.controller.loadingDomaines)
                  const Padding(padding: EdgeInsets.all(16), child: Center(child: CupertinoActivityIndicator()))
                else ...[
                  RadioGroup<String>(
                    groupValue: _draft.domain,
                    onChanged: (v) => setState(() => _draft = _draft.copyWith(domain: v ?? '')),
                    child: Column(
                      children: [
                        const RadioListTile<String>(
                          value: '',
                          contentPadding: EdgeInsets.zero,
                          title: Text('Tous les domaines'),
                        ),
                        for (final d in domains)
                          RadioListTile<String>(
                            value: d.code,
                            contentPadding: EdgeInsets.zero,
                            title: Text(d.name),
                            subtitle: d.label != d.name
                                ? Text(d.label, maxLines: 1, overflow: TextOverflow.ellipsis)
                                : null,
                          ),
                      ],
                    ),
                  ),
                  if (domains.isEmpty)
                    Text(
                      widget.controller.domaines.isEmpty ? 'Aucun domaine disponible' : 'Aucun domaine ne correspond',
                      style: const TextStyle(color: AppColors.textMuted),
                    ),
                ],
                _label('Filtres avancés', CupertinoIcons.slider_horizontal_3),
                TextField(
                  controller: _author,
                  decoration: const InputDecoration(
                    labelText: 'Auteur',
                    hintText: "Nom de l'auteur",
                    prefixIcon: Icon(CupertinoIcons.person, size: 20),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _title,
                  decoration: const InputDecoration(
                    labelText: 'Titre',
                    hintText: 'Titre de la publication',
                    prefixIcon: Icon(CupertinoIcons.textformat_alt, size: 20),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _keywords,
                  decoration: const InputDecoration(
                    labelText: 'Mot-clé',
                    prefixIcon: Icon(CupertinoIcons.tag, size: 20),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _year,
                  keyboardType: TextInputType.number,
                  maxLength: 4,
                  decoration: const InputDecoration(
                    labelText: 'Année',
                    hintText: 'Ex. 2024',
                    counterText: '',
                    prefixIcon: Icon(CupertinoIcons.calendar, size: 20),
                  ),
                ),
                const SizedBox(height: 6),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Dépôt avec fichier'),
                  subtitle: const Text('Uniquement les ressources consultables'),
                  value: _draft.hasFile,
                  onChanged: (v) => setState(() => _draft = _draft.copyWith(hasFile: v)),
                ),
              ],
            ),
          ),
          const Divider(),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
              child: Row(
                children: [
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.textSecondary,
                      padding: const EdgeInsets.symmetric(horizontal: 18),
                    ),
                    onPressed: () => Navigator.of(context).pop(HalFilters(q: _draft.q)),
                    child: const Text('Réinitialiser'),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: () => Navigator.of(context).pop(_result),
                      child: const Text('Appliquer les filtres'),
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
