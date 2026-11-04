import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../../core/storage/local_store.dart';
import '../../../core/theme/app_colors.dart';
import 'external_resources_view.dart';
import 'openalex_view.dart';

/// Sources de ressources externes proposées en sous-onglets.
enum ExternalSource { hal, openAlex }

/// Ressources externes : sous-onglets HAL et OpenAlex Librairie.
class ExternalSourcesView extends StatefulWidget {
  const ExternalSourcesView({super.key, this.intro});

  static const sourceKey = 'homepageExternalSource';

  /// Bloc d'accueil affiché en tête de liste (salutation, chiffres clés).
  final Widget? intro;

  @override
  State<ExternalSourcesView> createState() => _ExternalSourcesViewState();
}

class _ExternalSourcesViewState extends State<ExternalSourcesView> {
  late ExternalSource _source = LocalStore.instance.getString(ExternalSourcesView.sourceKey) == 'openalex'
      ? ExternalSource.openAlex
      : ExternalSource.hal;
  late final Set<ExternalSource> _visited = {_source};

  void _select(ExternalSource source) {
    if (source == _source) return;
    setState(() {
      _source = source;
      _visited.add(source);
    });
    LocalStore.instance.setString(ExternalSourcesView.sourceKey, source == ExternalSource.openAlex ? 'openalex' : 'hal');
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _SourceTabs(value: _source, onChanged: _select),
        Expanded(
          child: IndexedStack(
            index: _source.index,
            children: [
              _visited.contains(ExternalSource.hal) ? ExternalResourcesView(intro: widget.intro) : const SizedBox.shrink(),
              _visited.contains(ExternalSource.openAlex) ? OpenAlexView(intro: widget.intro) : const SizedBox.shrink(),
            ],
          ),
        ),
      ],
    );
  }
}

/// Barre de sous-onglets (onglet actif sur fond bleu, texte et icône blancs).
class _SourceTabs extends StatelessWidget {
  const _SourceTabs({required this.value, required this.onChanged});

  final ExternalSource value;
  final ValueChanged<ExternalSource> onChanged;

  @override
  Widget build(BuildContext context) {
    Widget tab(ExternalSource source, IconData icon, String title, String subtitle) {
      final selected = value == source;
      return Expanded(
        child: Semantics(
          button: true,
          selected: selected,
          label: '$title — $subtitle',
          excludeSemantics: true,
          child: Material(
            color: selected ? AppColors.primary : Colors.transparent,
            child: InkWell(
              onTap: () => onChanged(source),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(icon, size: 18, color: selected ? Colors.white : AppColors.textFaint),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: selected ? Colors.white : AppColors.textSecondary,
                            ),
                          ),
                          Text(
                            subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 11, color: selected ? Colors.white70 : AppColors.textMuted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Material(
      color: AppColors.surface,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.primary, width: 2)),
        ),
        child: Row(
          children: [
            tab(ExternalSource.hal, CupertinoIcons.doc_text_search, 'HAL', 'Hyper Articles en Ligne'),
            tab(ExternalSource.openAlex, CupertinoIcons.book_circle, 'OpenAlex', 'Librairie'),
          ],
        ),
      ),
    );
  }
}
