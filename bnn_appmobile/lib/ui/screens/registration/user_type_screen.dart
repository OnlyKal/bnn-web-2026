import 'package:flutter/material.dart';

import '../../../data/models/registration.dart';
import 'registration_form_screen.dart';
import 'registration_scaffold.dart';

class UserTypeScreen extends StatelessWidget {
  const UserTypeScreen({super.key, required this.selection});

  final RegistrationSelection selection;

  @override
  Widget build(BuildContext context) {
    return RegistrationScaffold(
      step: 3,
      title: 'Votre profil',
      subtitle: 'Choisissez le type de compte qui correspond à votre activité.',
      selection: selection,
      body: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 24),
        itemCount: UserType.all.length,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final type = UserType.all[index];
          return SelectableTile(
            leading: IconBadge(type.icon, size: 52),
            title: type.name,
            subtitle: type.description,
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => RegistrationFormScreen(
                  selection: selection.copyWith(userType: type),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
