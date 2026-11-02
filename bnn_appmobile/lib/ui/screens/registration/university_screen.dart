import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/registration.dart';
import '../../../data/repositories/registration_repository.dart';
import '../../widgets/common.dart';
import '../../widgets/states.dart';
import 'registration_scaffold.dart';
import 'user_type_screen.dart';

class UniversityScreen extends StatefulWidget {
  const UniversityScreen({super.key, required this.selection});

  final RegistrationSelection selection;

  @override
  State<UniversityScreen> createState() => _UniversityScreenState();
}

class _UniversityScreenState extends State<UniversityScreen> {
  final _search = TextEditingController();
  late final Future<List<Universite>> _future =
      RegistrationRepository.instance.universitesFor(widget.selection.province);
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<Universite> _filter(List<Universite> all) {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return all;
    return all
        .where((u) => u.nom.toLowerCase().contains(q) || u.shortname.toLowerCase().contains(q))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return RegistrationScaffold(
      step: 2,
      title: 'Votre établissement',
      subtitle: "Choisissez votre université ou institut d'enseignement supérieur.",
      selection: widget.selection,
      body: FutureBuilder<List<Universite>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return const StatusView.error(message: 'Liste des établissements indisponible.');
          }
          if (!snapshot.hasData) return const Center(child: CupertinoActivityIndicator());
          final items = _filter(snapshot.data!);
          return CustomScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
                sliver: SliverToBoxAdapter(
                  child: SearchField(
                    controller: _search,
                    hint: "Nom de l'établissement ou sigle…",
                    onChanged: (v) => setState(() => _query = v),
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 6, 20, 8),
                sliver: SliverToBoxAdapter(
                  child: Text(
                    '${items.length} ${plural(items.length, 'établissement')} ${plural(items.length, 'trouvé')}',
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                  ),
                ),
              ),
              if (items.isEmpty)
                const SliverFillRemaining(
                  hasScrollBody: false,
                  child: StatusView(
                    icon: CupertinoIcons.building_2_fill,
                    title: 'Aucun établissement trouvé',
                    message: 'Essayez de modifier votre recherche.',
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  sliver: SliverList.separated(
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final universite = items[index];
                      return SelectableTile(
                        leading: _UniversityLogo(universite: universite),
                        title: universite.nom,
                        subtitle: universite.shortname,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => UserTypeScreen(
                              selection: widget.selection.copyWith(universite: universite),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _UniversityLogo extends StatelessWidget {
  const _UniversityLogo({required this.universite});

  final Universite universite;

  @override
  Widget build(BuildContext context) {
    final asset = universite.logoAsset;
    if (asset == null) return const IconBadge(CupertinoIcons.building_2_fill);
    return Container(
      width: 46,
      height: 46,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: AppColors.border),
      ),
      child: Image.asset(
        asset,
        fit: BoxFit.contain,
        cacheWidth: 138,
        errorBuilder: (_, _, _) => const Icon(CupertinoIcons.building_2_fill, color: AppColors.primary),
      ),
    );
  }
}
