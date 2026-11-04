import 'package:flutter/widgets.dart';

import '../../core/theme/app_colors.dart';

/// Couverture de remplacement pour un PDF sans couverture : logo PDF centré.
class PdfCover extends StatelessWidget {
  const PdfCover({super.key, this.width, this.height, this.radius = 8});

  final double? width;
  final double? height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: AppColors.border),
      ),
      alignment: Alignment.center,
      child: FractionallySizedBox(
        heightFactor: 0.62,
        child: const AspectRatio(aspectRatio: 48 / 60, child: PdfLogo()),
      ),
    );
  }
}

/// Logo PDF : page à coin replié et étiquette rouge.
class PdfLogo extends StatelessWidget {
  const PdfLogo({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(label: 'PDF', child: CustomPaint(painter: _PdfLogoPainter()));
  }
}

class _PdfLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    // Dessiné sur une grille de 48 × 60, comme le logo du site web.
    canvas.scale(size.width / 48, size.height / 60);
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeJoin = StrokeJoin.round
      ..color = const Color(0xFFCBD5E1);

    final page = Path()
      ..moveTo(4, 1.5)
      ..lineTo(32, 1.5)
      ..lineTo(46.5, 16)
      ..lineTo(46.5, 56.5)
      ..arcToPoint(const Offset(44.5, 58.5), radius: const Radius.circular(2))
      ..lineTo(4, 58.5)
      ..arcToPoint(const Offset(2, 56.5), radius: const Radius.circular(2))
      ..lineTo(2, 3.5)
      ..arcToPoint(const Offset(4, 1.5), radius: const Radius.circular(2))
      ..close();
    canvas.drawPath(page, Paint()..color = const Color(0xFFFFFFFF));
    canvas.drawPath(page, stroke);

    final fold = Path()
      ..moveTo(32, 1.5)
      ..lineTo(32, 14)
      ..arcToPoint(const Offset(34, 16), radius: const Radius.circular(2), clockwise: false)
      ..lineTo(46.5, 16);
    canvas.drawPath(fold, Paint()..color = const Color(0xFFF1F5F9));
    canvas.drawPath(fold, stroke);

    final line = Paint()..color = const Color(0xFFE2E8F0);
    canvas.drawRRect(RRect.fromLTRBR(9, 22, 31, 24.5, const Radius.circular(1.25)), line);
    canvas.drawRRect(RRect.fromLTRBR(9, 28, 39, 30.5, const Radius.circular(1.25)), line);

    canvas.drawRRect(
      RRect.fromLTRBR(0, 36, 40, 51, const Radius.circular(2.5)),
      Paint()..color = const Color(0xFFDC2626),
    );
    final label = TextPainter(
      text: const TextSpan(
        text: 'PDF',
        style: TextStyle(
          color: Color(0xFFFFFFFF),
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
          height: 1,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    label.paint(canvas, Offset(20 - label.width / 2, 43.5 - label.height / 2));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
