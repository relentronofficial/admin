import 'package:flutter/material.dart';

import '../theme/design_constants.dart';

class AppLogo extends StatelessWidget {
  final double width;
  final double height;
  final BoxFit fit;

  const AppLogo({
    super.key,
    this.width = 120.0,
    this.height = 36.0,
    this.fit = BoxFit.contain,
  });

  const AppLogo.appBar({super.key})
      : width = 120.0,
        height = 36.0,
        fit = BoxFit.contain;

  const AppLogo.card({super.key})
      : width = 140.0,
        height = 48.0,
        fit = BoxFit.contain;

  const AppLogo.small({super.key})
      : width = 80.0,
        height = 24.0,
        fit = BoxFit.contain;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: width,
      height: height,
      alignment: Alignment.center,
      child: Image.asset(
        isDark
            ? 'assets/images/TBT C Pvt Final logo-04.png'
            : 'assets/images/TBT C Pvt Final logo-light.png',
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (context, error, stackTrace) => Text(
          'TBT',
          style: TextStyle(
            color: kColorAccent,
            fontSize: height * 0.45,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.0,
          ),
        ),
      ),
    );
  }
}
