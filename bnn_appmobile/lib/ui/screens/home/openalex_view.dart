import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../app_services.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/history_item.dart';
import '../../../data/models/openalex.dart';
import '../../../data/services/openalex_service.dart';
import '../../../state/history_controller.dart';
import '../../../state/openalex_controller.dart';
import '../../widgets/common.dart';
import '../../widgets/pdf_cover.dart';
import '../../widgets/states.dart';
import '../resource/openalex_details_screen.dart';

const _languages = [('', 'Toutes les langues'), ('fr', 'Français'), ('en', 'Anglais')];

/// Icône d'un type de document OpenAlex.
IconData openAlexTypeIcon(String? type) => switch (type) {
      'book' => CupertinoIcons.book,
      'book-chapter' => CupertinoIcons.bookmark,
      'article' || 'review' => CupertinoIcons.news,
      'dissertation' => CupertinoIcons.doc_richtext,
      'report' => CupertinoIcons.doc_chart,
      'dataset' => CupertinoIcons.table,
      _ => CupertinoIcons.doc_text,
    };

IconData _catalogIcon(OpenAlexCatalog catalog) => switch (catalog) {
      OpenAlexCatalog.all => CupertinoIcons.square_grid_2x2,
      OpenAlexCatalog.books => CupertinoIcons.book,
      OpenAlexCatalog.chapters => CupertinoIcons.bookmark,
      OpenAlexCatalog.articles => CupertinoIcons.news,
    };

/// Bibliothèque OpenAlex : livres, chapitres et articles scientifiques.
class OpenAlexView extends StatefulWidget {
  const OpenAlexView({super.key, this.intro});

  /// Bloc d'accueil affiché en tête de liste (salutation, chiffres clés).
  final Widget? intro;

  @override
  State<OpenAlexView> createState() => _OpenAlexViewState();
}

class _OpenAlexViewState extends State<OpenAlexView> with AutomaticKeepAliveClientMixin {
  late final OpenAlexController _controller = OpenAlexController(context.read<AppServices>().openAlex)..init();
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
            description: 'Recherche effectuée dans OpenAlex',
            metadata: {'query': 'openalex:$query'},
          );
    }
    _controller.apply(_controller.filters.copyWith(search: query));
  }

  Future<void> _openFilters() async {
    final next = await showModalBottomSheet<OpenAlexFilters>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _OpenAlexFiltersSheet(initial: _controller.filters),
    );
    if (next != null) _controller.apply(next);
  }

  Future<void> _pickDomain() async {
    final selected = await showModalBottomSheet<List<OpenAlexCategoryRef>>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _OpenAlexDomainSheet(
        service: context.read<AppServices>().openAlex,
        catalog: _controller.catalog,
        filters: _controller.filters,
      ),
    );
    if (selected != null) _controller.selectCategories(selected);
  }

  void _open(OpenAlexWork work) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => OpenAlexDetailsScreen(workId: work.id, initial: work),
    ));
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return ListenableBuilder(
      listenable: _controller,
      builder: (context, _) {
        final c = _controller;
        final f = c.filters;
        final activeChips = <(String, OpenAlexFilters)>[
          if (f.language.isNotEmpty)
            (_languages.firstWhere((l) => l.$1 == f.language, orElse: () => (f.language, f.language)).$2,
                f.copyWith(language: '')),
          if (f.yearFrom.isNotEmpty) ('Depuis ${f.yearFrom}', f.copyWith(yearFrom: '')),
          if (f.yearTo.isNotEmpty) ('Jusqu’à ${f.yearTo}', f.copyWith(yearTo: '')),
          if (f.openAccessOnly) ('Libre accès', f.copyWith(openAccessOnly: false)),
          if (!f.pdfOnly) ('Avec et sans PDF', f.copyWith(pdfOnly: true)),
          if (f.author.isNotEmpty) ('Auteur : ${f.author}', f.copyWith(author: '')),
          if (f.sort.isNotEmpty)
            ('Tri : ${OpenAlexSort.options.firstWhere((o) => o.$1 == f.sort, orElse: () => (f.sort, f.sort)).$2}',
                f.copyWith(sort: '')),
        ];

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
                          hint: 'Titre, résumé, mot-clé…',
                          onSubmitted: _submitQuery,
                          onClear: () => _submitQuery(''),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton.filled(
                        tooltip: 'Filtres OpenAlex',
                        style: IconButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          minimumSize: const Size(48, 48),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: _openFilters,
                        icon: Badge.count(
                          count: c.activeFilterCount,
                          isLabelVisible: c.activeFilterCount > 0,
                          backgroundColor: AppColors.cyan,
                          textColor: AppColors.deep,
                          child: const Icon(CupertinoIcons.slider_horizontal_3, size: 20, color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: ChipBar(
                  height: 56,
                  itemCount: OpenAlexCatalog.values.length,
                  itemBuilder: (context, index) {
                    final catalog = OpenAlexCatalog.values[index];
                    final selected = c.catalog == catalog;
                    return ChoiceChip(
                      avatar: Icon(_catalogIcon(catalog), size: 16, color: selected ? Colors.white : AppColors.primary),
                      label: Text(catalog.label),
                      selected: selected,
                      onSelected: (_) => c.selectCatalog(catalog),
                    );
                  },
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 4),
                sliver: SliverToBoxAdapter(
                  child: _DomainField(
                    categories: f.categories,
                    available: f.pdfOnly,
                    onPick: _pickDomain,
                    onClear: () => c.selectCategories(const []),
                  ),
                ),
              ),
              if (activeChips.isNotEmpty)
                SliverToBoxAdapter(
                  child: ChipBar(
                    height: 46,
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
                    itemCount: activeChips.length,
                    itemBuilder: (context, index) {
                      final (label, without) = activeChips[index];
                      return InputChip(
                        label: Text(label),
                        backgroundColor: AppColors.primarySoft,
                        side: const BorderSide(color: AppColors.primaryTint),
                        labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primary),
                        deleteIcon: const Icon(CupertinoIcons.xmark, size: 14, color: AppColors.primary),
                        onDeleted: () => c.apply(without),
                        deleteButtonTooltipMessage: 'Retirer ce filtre',
                      );
                    },
                  ),
                ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 12),
                sliver: SliverToBoxAdapter(
                  child: SectionHeader(
                    title: c.catalog == OpenAlexCatalog.all ? 'Bibliothèque OpenAlex' : c.catalog.label,
                    subtitle: c.loading
                        ? 'Recherche…'
                        : '${formatNumber(c.total)} ${plural(c.total, 'résultat')} · Source : OpenAlex',
                    icon: CupertinoIcons.book_circle,
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
              else if (c.error != null)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: StatusView.error(message: c.error, onAction: c.retry),
                )
              else if (c.items.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: StatusView(
                    icon: CupertinoIcons.search,
                    title: 'Aucune publication trouvée',
                    message: f.pdfOnly
                        ? 'Aucune publication avec PDF lisible ne correspond. Modifiez votre recherche, '
                            'ou incluez les publications sans PDF dans les filtres.'
                        : 'Aucune publication OpenAlex ne correspond à ces critères. Modifiez votre recherche ou vos filtres.',
                    actionLabel: f.pdfOnly ? 'Inclure les publications sans PDF' : null,
                    onAction: f.pdfOnly ? () => c.apply(f.copyWith(pdfOnly: false)) : null,
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverList.separated(
                    itemCount: c.items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final work = c.items[index];
                      return OpenAlexWorkCard(work: work, onTap: () => _open(work));
                    },
                  ),
                ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                  child: _ListFooter(controller: c),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _ListFooter extends StatelessWidget {
  const _ListFooter({required this.controller});

  final OpenAlexController controller;

  @override
  Widget build(BuildContext context) {
    final c = controller;
    if (c.loading || c.items.isEmpty) return const SizedBox.shrink();
    if (c.loadingMore) return const Center(child: CupertinoActivityIndicator());
    if (c.loadMoreError != null) {
      return Column(
        children: [
          Text(c.loadMoreError!, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.danger, fontSize: 13)),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => c.loadMore(manual: true),
            icon: const Icon(CupertinoIcons.arrow_clockwise, size: 16),
            label: const Text('Réessayer'),
          ),
        ],
      );
    }
    if (c.hasMore) {
      return OutlinedButton.icon(
        onPressed: c.loadMore,
        icon: const Icon(CupertinoIcons.chevron_down, size: 16),
        label: const Text('Charger plus'),
      );
    }
    if (c.reachedLimit) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.fill, borderRadius: BorderRadius.circular(12)),
        child: const Row(
          children: [
            Icon(CupertinoIcons.info_circle, size: 18, color: AppColors.textMuted),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'OpenAlex limite la consultation aux 10 000 premiers résultats. Affinez votre recherche pour voir les autres.',
                style: TextStyle(color: AppColors.textMuted, fontSize: 12.5, height: 1.4),
              ),
            ),
          ],
        ),
      );
    }
    return const SizedBox.shrink();
  }
}

/// Carte d'une publication OpenAlex (OpenAlex ne fournit pas de couverture).
class OpenAlexWorkCard extends StatelessWidget {
  const OpenAlexWorkCard({super.key, required this.work, required this.onTap});

  final OpenAlexWork work;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final meta = [
      if (work.sourceName != null) work.sourceName!,
      if (work.sourceName == null && work.publisher != null) work.publisher!,
    ];
    return SurfaceCard(
      onTap: onTap,
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          OpenAlexCover(type: work.type, width: 62, height: 86, pdf: work.pdfAvailable),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(openAlexTypeIcon(work.type), size: 13, color: AppColors.primary),
                    const SizedBox(width: 5),
                    Flexible(
                      child: Text(
                        work.typeLabel.toUpperCase(),
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
                  work.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15, height: 1.28),
                ),
                if (work.authors.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    work.authorsLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                  ),
                ],
                if (meta.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    meta.join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Color.fromARGB(255, 20, 169, 149), fontSize: 12,),
                  ),
                ],
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    if (work.pdfAvailable) const Pill('PDF', color: AppColors.pdf, icon: CupertinoIcons.doc_text_fill),
                    if (work.openAccess == true) const Pill('Libre accès', color: AppColors.successDark),
                    if (work.language != null) Pill(work.language!.toUpperCase(), color: AppColors.navy),
                    if (work.year != null) Pill('${work.year}', color: AppColors.textMuted, icon: CupertinoIcons.calendar),
                    if (work.citedByCount > 0)
                      Pill(
                        '${formatNumber(work.citedByCount)} citation${work.citedByCount > 1 ? 's' : ''}',
                        color: AppColors.textMuted,
                        icon: CupertinoIcons.quote_bubble,
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Vignette d'une publication OpenAlex : logo PDF si le PDF est lisible,
/// sinon icône du type sur fond bleu clair.
class OpenAlexCover extends StatelessWidget {
  const OpenAlexCover({
    super.key,
    required this.type,
    required this.width,
    required this.height,
    this.radius = 8,
    this.pdf = false,
  });

  final String? type;
  final bool pdf;
  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    if (pdf) return PdfCover(width: width, height: height, radius: radius);
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: AppColors.primaryTint),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(openAlexTypeIcon(type), color: AppColors.primary.withValues(alpha: 0.6), size: width * 0.36),
          SizedBox(height: height * 0.06),
          Text(
            'OpenAlex',
            maxLines: 1,
            style: TextStyle(
              fontSize: (width * 0.14).clamp(8, 16).toDouble(),
              fontWeight: FontWeight.w700,
              color: AppColors.primary.withValues(alpha: 0.6),
            ),
          ),
        ],
      ),
    );
  }
}

class _OpenAlexFiltersSheet extends StatefulWidget {
  const _OpenAlexFiltersSheet({required this.initial});

  final OpenAlexFilters initial;

  @override
  State<_OpenAlexFiltersSheet> createState() => _OpenAlexFiltersSheetState();
}

class _OpenAlexFiltersSheetState extends State<_OpenAlexFiltersSheet> {
  late OpenAlexFilters _draft = widget.initial;
  late final _author = TextEditingController(text: _draft.author);
  late final _yearFrom = TextEditingController(text: _draft.yearFrom);
  late final _yearTo = TextEditingController(text: _draft.yearTo);
  String? _yearError;

  @override
  void dispose() {
    for (final c in [_author, _yearFrom, _yearTo]) {
      c.dispose();
    }
    super.dispose();
  }

  /// Années acceptées par le serveur : 1000 à 2100, début ≤ fin.
  String? _validateYears(String from, String to) {
    bool invalid(String y) => y.isNotEmpty && ((int.tryParse(y) ?? 0) < 1000 || (int.tryParse(y) ?? 0) > 2100);
    if (invalid(from) || invalid(to)) return 'Saisissez une année entre 1000 et 2100.';
    if (from.isNotEmpty && to.isNotEmpty && int.parse(from) > int.parse(to)) {
      return 'L’année de début doit précéder l’année de fin.';
    }
    return null;
  }

  void _apply() {
    final from = _yearFrom.text.trim();
    final to = _yearTo.text.trim();
    final error = _validateYears(from, to);
    if (error != null) {
      setState(() => _yearError = error);
      return;
    }
    Navigator.of(context).pop(_draft.copyWith(author: _author.text.trim(), yearFrom: from, yearTo: to));
  }

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
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.9,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      builder: (context, scroll) => Column(
        children: [
          const SheetHeader(
            title: 'Filtres OpenAlex',
            subtitle: 'Affinez la bibliothèque OpenAlex',
            icon: CupertinoIcons.slider_horizontal_3,
          ),
          const Divider(),
          Expanded(
            child: ListView(
              controller: scroll,
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: EdgeInsets.fromLTRB(20, 0, 20, 16 + MediaQuery.viewInsetsOf(context).bottom),
              children: [
                _label('Accès au document', CupertinoIcons.doc_text),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('PDF lisible dans la BNN'),
                  subtitle: const Text('Uniquement les publications dont le PDF s’ouvre dans le lecteur intégré'),
                  value: _draft.pdfOnly,
                  onChanged: (v) => setState(() => _draft = _draft.copyWith(pdfOnly: v)),
                ),
                if (!_draft.pdfOnly && _draft.categories.isNotEmpty)
                  const _InlineNote(
                    'Le filtre par domaine sera retiré : OpenAlex ne le propose que pour les publications avec PDF.',
                  ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Libre accès uniquement'),
                  subtitle: const Text('Publications en open access'),
                  value: _draft.openAccessOnly,
                  onChanged: (v) => setState(() => _draft = _draft.copyWith(openAccessOnly: v)),
                ),
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
                _label('Période de publication', CupertinoIcons.calendar),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _yearFrom,
                        keyboardType: TextInputType.number,
                        maxLength: 4,
                        onChanged: (_) => setState(() => _yearError = null),
                        decoration: const InputDecoration(labelText: 'De', hintText: 'Ex. 2000', counterText: ''),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: _yearTo,
                        keyboardType: TextInputType.number,
                        maxLength: 4,
                        onChanged: (_) => setState(() => _yearError = null),
                        decoration: const InputDecoration(labelText: 'À', hintText: 'Ex. 2024', counterText: ''),
                      ),
                    ),
                  ],
                ),
                if (_yearError != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 6, left: 4),
                    child: Text(_yearError!, style: const TextStyle(color: AppColors.danger, fontSize: 12.5)),
                  ),
                _label('Auteur', CupertinoIcons.person),
                TextField(
                  controller: _author,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    hintText: 'Nom tel qu’il figure dans la publication',
                    prefixIcon: Icon(CupertinoIcons.person, size: 20),
                  ),
                ),
                _label('Trier par', CupertinoIcons.arrow_up_arrow_down),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final (value, label) in OpenAlexSort.options)
                      ChoiceChip(
                        label: Text(label),
                        selected: _draft.sort == value,
                        onSelected: (_) => setState(() => _draft = _draft.copyWith(sort: value)),
                      ),
                  ],
                ),
                if (_draft.sort == 'relevance')
                  const Padding(
                    padding: EdgeInsets.only(top: 8, left: 4),
                    child: Text(
                      'Le tri par pertinence s’applique lorsqu’un texte est recherché.',
                      style: TextStyle(color: AppColors.textMuted, fontSize: 12.5),
                    ),
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
                    onPressed: () => Navigator.of(context).pop(OpenAlexFilters(search: _draft.search, categories: _draft.categories)),
                    child: const Text('Réinitialiser'),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(onPressed: _apply, child: const Text('Appliquer les filtres')),
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

class _InlineNote extends StatelessWidget {
  const _InlineNote(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 4, bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(color: AppColors.fill, borderRadius: BorderRadius.circular(10)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(CupertinoIcons.info_circle, size: 16, color: AppColors.textMuted),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: const TextStyle(color: AppColors.textMuted, fontSize: 12.5, height: 1.4))),
        ],
      ),
    );
  }
}

/// Sélecteur de domaine présenté comme un champ (ouvre la navigation par domaines).
class _DomainField extends StatelessWidget {
  const _DomainField({required this.categories, required this.available, required this.onPick, required this.onClear});

  final List<OpenAlexCategoryRef> categories;

  /// Faux quand les publications sans PDF sont incluses (filtre indisponible côté OpenAlex).
  final bool available;
  final VoidCallback onPick;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final active = categories.isNotEmpty;
    return Row(
      children: [
        Expanded(
          child: SurfaceCard(
            onTap: onPick,
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
                      Text(
                        active ? categories.last.level.label : 'Domaine',
                        style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                      ),
                      Text(
                        active ? categories.map((c) => c.label).join(' › ') : 'Tous les domaines',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: active ? AppColors.primary : AppColors.textPrimary,
                        ),
                      ),
                      if (!available)
                        const Text(
                          'Réservé aux publications avec PDF lisible',
                          style: TextStyle(fontSize: 11, color: AppColors.textFaint),
                        ),
                    ],
                  ),
                ),
                const Icon(CupertinoIcons.chevron_down, size: 15, color: AppColors.textFaint),
              ],
            ),
          ),
        ),
        if (active) ...[
          const SizedBox(width: 8),
          IconButton(
            tooltip: 'Effacer le domaine',
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

/// Navigation domaine › discipline › sous-discipline, avec le nombre de PDF de chaque catégorie
/// (selon la rubrique et les filtres courants).
class _OpenAlexDomainSheet extends StatefulWidget {
  const _OpenAlexDomainSheet({required this.service, required this.catalog, required this.filters});

  final OpenAlexService service;
  final OpenAlexCatalog catalog;
  final OpenAlexFilters filters;

  @override
  State<_OpenAlexDomainSheet> createState() => _OpenAlexDomainSheetState();
}

class _OpenAlexDomainSheetState extends State<_OpenAlexDomainSheet> {
  late List<OpenAlexCategoryRef> _path = widget.filters.categories;
  OpenAlexCategoryPage? _page;
  int? _selectedCount;
  List<OpenAlexCategoryRef> _loadedFor = const [];
  String? _error;
  bool _loading = true;
  int _requestId = 0;

  /// Catégories dont on affiche les enfants : au niveau le plus fin, on reste sur la liste des sœurs.
  List<OpenAlexCategoryRef> get _parents =>
      _path.isNotEmpty && _path.last.level.next == null ? _path.sublist(0, _path.length - 1) : _path;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final id = ++_requestId;
    _loadedFor = _parents;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // Comptes calculés avec les filtres courants, sans le domaine (c'est lui que l'on choisit).
      final page = await widget.service.categories(
        widget.catalog,
        widget.filters.copyWith(pdfOnly: true, categories: const []),
        parents: _parents,
      );
      if (!mounted || id != _requestId) return;
      setState(() => _page = page);
    } on ApiException catch (e) {
      if (mounted && id == _requestId) setState(() => _error = e.message);
    } finally {
      if (mounted && id == _requestId) setState(() => _loading = false);
    }
  }

  void _goTo(List<OpenAlexCategoryRef> path, {int? count}) {
    setState(() {
      _path = path;
      _selectedCount = count;
    });
    // Rechargement seulement si la liste affichée change de niveau (sinon : simple sélection d'une sœur).
    if (!listEquals(_parents, _loadedFor)) _load();
  }

  @override
  Widget build(BuildContext context) {
    final page = _page;
    final selected = _path.isEmpty ? null : _path.last;
    final crumbs = <(String, List<OpenAlexCategoryRef>)>[
      ('Tous les domaines', const []),
      for (var i = 0; i < _path.length; i++) (_path[i].label, _path.sublist(0, i + 1)),
    ];
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      builder: (context, scroll) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SheetHeader(
            title: 'Domaines',
            subtitle: 'Domaine › discipline › sous-discipline',
            icon: CupertinoIcons.folder,
          ),
          SizedBox(
            height: 40,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              itemCount: crumbs.length,
              separatorBuilder: (_, _) => const Padding(
                padding: EdgeInsets.symmetric(horizontal: 4),
                child: Icon(CupertinoIcons.chevron_right, size: 12, color: AppColors.textFaint),
              ),
              itemBuilder: (context, index) {
                final (label, path) = crumbs[index];
                final current = index == crumbs.length - 1;
                return Center(
                  child: InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: current ? null : () => _goTo(path),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
                      child: Text(
                        label,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: current ? FontWeight.w700 : FontWeight.w500,
                          color: current ? AppColors.textPrimary : AppColors.primary,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          if (!widget.filters.pdfOnly)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: _InlineNote(
                'OpenAlex ne propose le filtrage par domaine que pour les publications avec PDF : '
                'choisir un domaine réactive « PDF lisible dans la BNN ».',
              ),
            ),
          const Divider(),
          Expanded(
            child: _loading
                ? const Center(child: CupertinoActivityIndicator())
                : _error != null
                    ? StatusView.error(message: _error, onAction: _load, compact: true)
                    : page == null || page.items.isEmpty
                        ? const StatusView(
                            icon: CupertinoIcons.folder,
                            title: 'Aucune catégorie',
                            message: 'Aucune publication avec PDF ne correspond aux filtres actuels.',
                            compact: true,
                          )
                        : ListView(
                            controller: scroll,
                            children: [
                              Padding(
                                padding: const EdgeInsets.fromLTRB(20, 10, 20, 4),
                                child: Text(
                                  '${page.level.label}s · ${formatNumber(page.total)} PDF'
                                  '${page.level == OpenAlexCategoryLevel.subfield ? ' · noms fournis par OpenAlex' : ''}',
                                  style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                                ),
                              ),
                              for (final category in page.items)
                                ListTile(
                                  contentPadding: const EdgeInsets.only(left: 20, right: 12),
                                  selected: category.ref == selected,
                                  selectedTileColor: AppColors.primarySoft,
                                  title: Text(
                                    category.ref.label,
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      color: category.ref == selected ? AppColors.primary : AppColors.textPrimary,
                                    ),
                                  ),
                                  subtitle: Text('${formatNumber(category.count)} PDF'),
                                  trailing: category.ref == selected
                                      ? const Icon(CupertinoIcons.checkmark_alt, color: AppColors.primary)
                                      : category.ref.level.next != null
                                          ? const Icon(CupertinoIcons.chevron_right, size: 16, color: AppColors.textFaint)
                                          : null,
                                  onTap: () => _goTo([..._parents, category.ref], count: category.count),
                                ),
                              if (page.truncated)
                                const Padding(
                                  padding: EdgeInsets.all(20),
                                  child: Text(
                                    'Seules les 200 catégories les plus fournies sont affichées.',
                                    style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                                  ),
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
                    onPressed: () => Navigator.of(context).pop(const <OpenAlexCategoryRef>[]),
                    child: const Text('Tous'),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: () => Navigator.of(context).pop(_path),
                      child: Text(
                        selected == null
                            ? 'Afficher tous les domaines'
                            : _selectedCount != null
                                ? 'Afficher ${formatNumber(_selectedCount!)} PDF'
                                : 'Appliquer',
                        overflow: TextOverflow.ellipsis,
                      ),
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
