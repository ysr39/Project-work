import 'package:flutter/material.dart';

class AppColors {
  AppColors._();
  static const primary     = Color(0xFF2563EB); // Blue-600
  static const primaryDark = Color(0xFF1D4ED8);
  static const secondary   = Color(0xFF10B981); // Emerald-500
  static const error       = Color(0xFFEF4444);
  static const warning     = Color(0xFFF59E0B);
  static const surface     = Color(0xFFFFFFFF);
  static const background  = Color(0xFFF8FAFC);
  static const onSurface   = Color(0xFF0F172A);
  static const subtle      = Color(0xFF64748B);
  static const border      = Color(0xFFE2E8F0);
  static const mapOverlay  = Color(0x99000000);
}

class AppTheme {
  AppTheme._();

  static ThemeData get light => ThemeData(
    useMaterial3: true,
    fontFamily: 'Inter',
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: Brightness.light,
      surface: AppColors.surface,
      error: AppColors.error,
    ),
    scaffoldBackgroundColor: AppColors.background,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.surface,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: TextStyle(
        fontFamily: 'Inter',
        fontSize: 17,
        fontWeight: FontWeight.w600,
        color: AppColors.onSurface,
      ),
      iconTheme: IconThemeData(color: AppColors.onSurface),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primary, width: 2),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    ),
    cardTheme: CardTheme(
      color: AppColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.border),
      ),
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
    ),
    dividerTheme: const DividerThemeData(
      color: AppColors.border,
      thickness: 1,
      space: 0,
    ),
  );
}

class AppTextStyles {
  AppTextStyles._();
  static const h1 = TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: AppColors.onSurface, fontFamily: 'Inter');
  static const h2 = TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.onSurface, fontFamily: 'Inter');
  static const h3 = TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: AppColors.onSurface, fontFamily: 'Inter');
  static const body = TextStyle(fontSize: 15, fontWeight: FontWeight.w400, color: AppColors.onSurface, fontFamily: 'Inter');
  static const bodySmall = TextStyle(fontSize: 13, fontWeight: FontWeight.w400, color: AppColors.subtle, fontFamily: 'Inter');
  static const label = TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.subtle, fontFamily: 'Inter', letterSpacing: 0.5);
  static const price = TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.primary, fontFamily: 'Inter');
}
