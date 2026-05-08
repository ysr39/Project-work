import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class RecentTripTile extends StatelessWidget {
  final int index;
  const RecentTripTile({super.key, required this.index});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.directions_car_outlined, color: AppColors.primary, size: 20),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Airport → City Centre', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 14, fontFamily: 'Inter')),
                SizedBox(height: 2),
                Text('2 hours ago · Pool · ₹142', style: TextStyle(fontSize: 12, color: AppColors.subtle, fontFamily: 'Inter')),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.green.withOpacity(0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Text('Completed', style: TextStyle(fontSize: 11, color: Colors.green, fontWeight: FontWeight.w600, fontFamily: 'Inter')),
          ),
        ],
      ),
    );
  }
}
