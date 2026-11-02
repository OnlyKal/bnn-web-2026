import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/app_colors.dart';
import '../../widgets/common.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppColors.navy,
        body: SafeArea(
          child: SizedBox(
            width: double.infinity,
            child: Column(
              children: [
                Spacer(),
                BnnLogo(height: 80),
                SizedBox(height: 18),
                Text(
                  'ESURSI · République Démocratique du Congo',
                  style: TextStyle(color: AppColors.onNavyMuted, fontSize: 12.5),
                ),
                SizedBox(height: 36),
                CupertinoActivityIndicator(color: Colors.white, radius: 12),
                Spacer(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
