import 'dart:async';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../cubit/driver_cubit.dart';

class TripRequestBottomSheet extends StatefulWidget {
  final DriverTripRequest request;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  const TripRequestBottomSheet({
    super.key,
    required this.request,
    required this.onAccept,
    required this.onDecline,
  });

  @override
  State<TripRequestBottomSheet> createState() => _TripRequestBottomSheetState();
}

class _TripRequestBottomSheetState extends State<TripRequestBottomSheet> {
  late int _remaining;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _remaining = widget.request.expiresIn;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_remaining > 0) {
        setState(() => _remaining--);
      } else {
        _timer?.cancel();
        widget.onDecline();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pct = _remaining / widget.request.expiresIn;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Timer bar
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value:            pct,
              backgroundColor:  AppColors.border,
              valueColor: AlwaysStoppedAnimation(pct > 0.5 ? AppColors.secondary : AppColors.error),
              minHeight: 6,
            ),
          ),
          const SizedBox(height: 4),
          Align(
            alignment: Alignment.centerRight,
            child: Text('${_remaining}s', style: AppTextStyles.label),
          ),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('New Pool Request', style: AppTextStyles.h3),
                    Text('${widget.request.seats} seat${widget.request.seats > 1 ? "s" : ""}', style: AppTextStyles.bodySmall),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('₹${widget.request.estimatedFare.toStringAsFixed(0)}', style: AppTextStyles.price),
                  Text('${widget.request.distanceKm.toStringAsFixed(1)} km', style: AppTextStyles.bodySmall),
                ],
              ),
            ],
          ),

          const Divider(height: 24),

          _StopRow(icon: Icons.radio_button_on, color: AppColors.primary, label: 'Pickup', address: widget.request.pickupAddress),
          const SizedBox(height: 8),
          _StopRow(icon: Icons.location_on, color: AppColors.error, label: 'Drop-off', address: widget.request.dropoffAddress),

          const SizedBox(height: 24),

          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: widget.onDecline,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.error,
                    side: const BorderSide(color: AppColors.error),
                    minimumSize: const Size.fromHeight(48),
                  ),
                  child: const Text('Decline'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton(
                  onPressed: widget.onAccept,
                  child: const Text('Accept'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StopRow extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  final String address;

  const _StopRow({
    required this.icon,
    required this.color,
    required this.label,
    required this.address,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: AppTextStyles.label),
              Text(address, style: AppTextStyles.body, maxLines: 1, overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
      ],
    );
  }
}
