import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../rider/domain/entities/trip_entity.dart';
import '../cubit/history_cubit.dart';

class HistoryPage extends StatelessWidget {
  const HistoryPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<HistoryCubit>()..load(),
      child: Scaffold(
        appBar: AppBar(title: const Text('Trip History')),
        body: BlocBuilder<HistoryCubit, HistoryState>(
          builder: (context, state) => switch (state) {
            HistoryLoading() => const Center(child: CircularProgressIndicator()),
            HistoryLoaded(:final trips) when trips.isEmpty => const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.directions_car_outlined, size: 64, color: AppColors.border),
                    SizedBox(height: 12),
                    Text('No trips yet', style: AppTextStyles.body),
                    Text('Your rides will appear here', style: AppTextStyles.bodySmall),
                  ],
                ),
              ),
            HistoryLoaded(:final trips) => ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                itemCount: trips.length,
                itemBuilder: (_, i) => _TripCard(trip: trips[i]),
              ),
            HistoryError(:final message) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline, color: AppColors.error, size: 40),
                    const SizedBox(height: 8),
                    Text(message, style: const TextStyle(color: AppColors.error)),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: () => context.read<HistoryCubit>().load(),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            _ => const SizedBox.shrink(),
          },
        ),
      ),
    );
  }
}

class _TripCard extends StatelessWidget {
  final TripEntity trip;
  const _TripCard({required this.trip});

  Color get _statusColor => switch (trip.status) {
    'COMPLETED' => Colors.green,
    'CANCELLED' => AppColors.error,
    _           => AppColors.warning,
  };

  IconData get _statusIcon => switch (trip.status) {
    'COMPLETED' => Icons.check_circle_outline,
    'CANCELLED' => Icons.cancel_outlined,
    _           => Icons.schedule,
  };

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    children: [
                      Icon(_statusIcon, color: _statusColor, size: 14),
                      const SizedBox(width: 4),
                      Text(
                        trip.status,
                        style: TextStyle(color: _statusColor, fontWeight: FontWeight.w600, fontSize: 12, fontFamily: 'Inter'),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                Text(
                  DateFormat('dd MMM, hh:mm a').format(trip.createdAt.toLocal()),
                  style: AppTextStyles.bodySmall,
                ),
              ],
            ),
            const SizedBox(height: 12),
            _RouteRow(icon: Icons.radio_button_on, color: AppColors.primary, address: trip.pickupAddress),
            const Padding(
              padding: EdgeInsets.only(left: 9),
              child: SizedBox(height: 16, child: VerticalDivider(width: 1, color: AppColors.border)),
            ),
            _RouteRow(icon: Icons.location_on, color: AppColors.error, address: trip.dropoffAddress),
            const Divider(height: 20),
            Row(
              children: [
                const Icon(Icons.people_alt_outlined, size: 16, color: AppColors.subtle),
                const SizedBox(width: 4),
                Text('${trip.seats} seat${trip.seats > 1 ? "s" : ""} · Pool', style: AppTextStyles.bodySmall),
                const Spacer(),
                Text(
                  '₹${trip.estimatedFare.toStringAsFixed(0)}',
                  style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w700, color: AppColors.primary),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _RouteRow extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String address;

  const _RouteRow({required this.icon, required this.color, required this.address});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 8),
        Expanded(
          child: Text(address, style: AppTextStyles.body, maxLines: 1, overflow: TextOverflow.ellipsis),
        ),
      ],
    );
  }
}
