import 'package:flutter/cupertino.dart';

class Province {
  const Province({required this.code, required this.nom, required this.chefLieu});

  factory Province.fromJson(Map<String, dynamic> json) => Province(
        code: json['code']?.toString() ?? '',
        nom: json['nom']?.toString() ?? '',
        chefLieu: json['chef_lieu']?.toString() ?? '',
      );

  final String code;
  final String nom;
  final String chefLieu;
}

class Universite {
  const Universite({required this.nom, required this.shortname, this.logoAsset});

  final String nom;
  final String shortname;

  /// Chemin de l'asset du logo, ou `null` si aucun logo n'est disponible.
  final String? logoAsset;
}

class UserType {
  const UserType({
    required this.value,
    required this.name,
    required this.description,
    required this.icon,
  });

  final String value;
  final String name;
  final String description;
  final IconData icon;

  static const all = [
    UserType(
      value: 'chercheur',
      name: 'Chercheur',
      description: 'Recherche académique et scientifique',
      icon: CupertinoIcons.lab_flask,
    ),
    UserType(
      value: 'etudiant',
      name: 'Étudiant',
      description: 'Apprentissage et études',
      icon: CupertinoIcons.book,
    ),
    UserType(
      value: 'professeur',
      name: 'Professeur',
      description: 'Enseignement et formation',
      icon: CupertinoIcons.person_crop_rectangle,
    ),
    UserType(
      value: 'autres',
      name: 'Autres',
      description: 'Autres professions',
      icon: CupertinoIcons.person_3,
    ),
  ];
}

/// Sélections accumulées pendant le parcours d'inscription.
class RegistrationSelection {
  const RegistrationSelection({this.province, this.universite, this.userType});

  final Province? province;
  final Universite? universite;
  final UserType? userType;

  RegistrationSelection copyWith({Province? province, Universite? universite, UserType? userType}) =>
      RegistrationSelection(
        province: province ?? this.province,
        universite: universite ?? this.universite,
        userType: userType ?? this.userType,
      );
}
