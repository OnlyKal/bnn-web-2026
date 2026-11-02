import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/registration.dart';
import '../../../data/repositories/registration_repository.dart';
import '../../widgets/common.dart';
import '../../widgets/states.dart';
import 'registration_scaffold.dart';
import 'university_screen.dart';

class ProvinceScreen extends StatefulWidget {
  const ProvinceScreen({super.key});

  @override
  State<ProvinceScreen> createState() => _ProvinceScreenState();
}

class _ProvinceScreenState extends State<ProvinceScreen> {
  final _search = TextEditingController();
  late final Future<List<Province>> _future = RegistrationRepository.instance.provinces();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<Province> _filter(List<Province> all) {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return all;
    return all
        .where((p) =>
            p.nom.toLowerCase().contains(q) ||
            p.chefLieu.toLowerCase().contains(q) ||
            p.code.toLowerCase().contains(q))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return RegistrationScaffold(
      step: 1,
      title: 'Votre province',
      subtitle: 'Elle nous permet de vous proposer les établissements de votre région.',
      selection: const RegistrationSelection(),
      body: FutureBuilder<List<Province>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return const StatusView.error(message: 'Liste des provinces indisponible.');
          }
          if (!snapshot.hasData) return const Center(child: CupertinoActivityIndicator());
          final provinces = _filter(snapshot.data!);
          return CustomScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
                sliver: SliverToBoxAdapter(
                  child: SearchField(
                    controller: _search,
                    hint: 'Nom, chef-lieu ou code…',
                    onChanged: (v) => setState(() => _query = v),
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 6, 20, 8),
                sliver: SliverToBoxAdapter(
                  child: Text(
                    '${provinces.length} ${plural(provinces.length, 'province')} ${plural(provinces.length, 'trouvée')}',
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                  ),
                ),
              ),
              if (provinces.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: StatusView(
                    icon: CupertinoIcons.location_slash,
                    title: 'Aucune province trouvée',
                    message: 'Aucun résultat pour « $_query ».',
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  sliver: SliverList.separated(
                    itemCount: provinces.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final province = provinces[index];
                      return SelectableTile(
                        leading: const IconBadge(CupertinoIcons.location_fill),
                        title: province.nom,
                        subtitle: 'Chef-lieu : ${province.chefLieu}',
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => UniversityScreen(
                              selection: RegistrationSelection(province: province),
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
