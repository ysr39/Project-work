import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../cubit/rider_cubit.dart';

class RideTrackingPage extends StatefulWidget {
  final String tripId;
  const RideTrackingPage({super.key, required this.tripId});

  @override
  State<RideTrackingPage> createState() => _RideTrackingPageState();
}

class _RideTrackingPageState extends State<RideTrackingPage> {
  GoogleMapController? _mapCtrl;
  final Set<Marker> _markers = {};
  final Set<Polyline> _polylines = {};

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<RiderCubit>(),
      child: BlocConsumer<RiderCubit, RiderState>(
        listener: (context, state) {
          if (state is RiderCompleted) {
            _showCompletionSheet(context, state);
          }
          if (state is RiderError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message), backgroundColor: AppColors.error),
            );
            context.go(AppRoutes.riderDashboard);
          }
          if (state is RiderMatched) {
            _updateDriverMarker(state.trip.driverLat, state.trip.driverLng);
          }
          if (state is RiderInProgress) {
            _updateDriverMarker(state.trip.driverLat, state.trip.driverLng);
          }
        },
        builder: (context, state) {
          return Scaffold(
            body: Stack(
              children: [
                GoogleMap(
                  initialCameraPosition: const CameraPosition(
                    target: LatLng(28.6139, 77.2090), // fallback: New Delhi
                    zoom:   15,
                  ),
                  markers:   _markers,
                  polylines: _polylines,
                  myLocationEnabled:         true,
                  myLocationButtonEnabled:   false,
                  zoomControlsEnabled:       false,
                  onMapCreated: (ctrl) => _mapCtrl = ctrl,
                ),
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: _TripStatusSheet(state: state, tripId: widget.tripId),
                ),
                Positioned(
                  top: MediaQuery.of(context).padding.top + 8,
                  left: 12,
                  child: _BackButton(),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _updateDriverMarker(double? lat, double? lng) {
    if (lat == null || lng == null) return;
    final pos = LatLng(lat, lng);
    setState(() {
      _markers
        ..removeWhere((m) => m.markerId.value == 'driver')
        ..add(Marker(
          markerId: const MarkerId('driver'),
          position: pos,
          icon:     BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
        ));
    });
    _mapCtrl?.animateCamera(CameraUpdate.newLatLng(pos));
  }

  void _showCompletionSheet(BuildContext context, RiderCompleted state) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CompletionSheet(
        fare:  (state.summary['fareAmount'] as num?)?.toDouble() ?? 0,
        km:    (state.summary['distanceKm'] as num?)?.toDouble() ?? 0,
        onDone: () => context.go(AppRoutes.riderDashboard),
      ),
    );
  }
}

class _BackButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.pop(),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.12), blurRadius: 8),
        ]),
        child: const Icon(Icons.arrow_back, size: 20),
      ),
    );
  }
}

class _TripStatusSheet extends StatelessWidget {
  final RiderState state;
  final String tripId;
  const _TripStatusSheet({required this.state, required this.tripId});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 16)],
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      child: switch (state) {
        RiderWaitingForMatch() => _searchingContent(),
        RiderMatched(:final trip) => _matchedContent(context, trip),
        RiderInProgress(:final trip) => _inProgressContent(trip),
        _ => const SizedBox.shrink(),
      },
    );
  }

  Widget _searchingContent() => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      const _SheetHandle(),
      const SizedBox(height: 16),
      const CircularProgressIndicator(),
      const SizedBox(height: 16),
      Text('Finding your pool ride...', style: AppTextStyles.h3),
      const SizedBox(height: 4),
      Text('Matching you with nearby riders', style: AppTextStyles.bodySmall),
    ],
  );

  Widget _matchedContent(BuildContext context, trip) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      const _SheetHandle(),
      const SizedBox(height: 12),
      Row(
        children: [
          Container(
            width: 48, height: 48,
            decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
            child: const Icon(Icons.directions_car, color: Colors.white),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(trip.driverName ?? 'Your Driver', style: AppTextStyles.h3),
                Text('${trip.vehicleMake ?? ''} · ${trip.plateNumber ?? ''}', style: AppTextStyles.bodySmall),
              ],
            ),
          ),
          if (trip.etaMinutes != null)
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('ETA', style: AppTextStyles.label),
                Text('${trip.etaMinutes} min', style: AppTextStyles.h3.copyWith(color: AppColors.primary)),
              ],
            ),
        ],
      ),
      const Divider(height: 24),
      _StatusBadge(label: 'Driver is on the way', color: AppColors.warning),
      const SizedBox(height: 12),
      OutlinedButton(
        onPressed: () => context.read<RiderCubit>().cancelCurrentRide(tripId),
        style: OutlinedButton.styleFrom(foregroundColor: AppColors.error, side: const BorderSide(color: AppColors.error)),
        child: const Text('Cancel Ride'),
      ),
    ],
  );

  Widget _inProgressContent(trip) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      const _SheetHandle(),
      const SizedBox(height: 12),
      _StatusBadge(label: 'Ride in progress', color: AppColors.secondary),
      const SizedBox(height: 12),
      Text('Heading to your destination', style: AppTextStyles.body),
      if (trip.dropoffAddress.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(trip.dropoffAddress, style: AppTextStyles.bodySmall),
        ),
    ],
  );
}

class _SheetHandle extends StatelessWidget {
  const _SheetHandle();
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 40, height: 4,
        decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String label;
  final Color color;
  const _StatusBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 13, fontFamily: 'Inter')),
    );
  }
}

class _CompletionSheet extends StatelessWidget {
  final double fare;
  final double km;
  final VoidCallback onDone;

  const _CompletionSheet({required this.fare, required this.km, required this.onDone});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 40),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const _SheetHandle(),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(color: Color(0xFFE8F5E9), shape: BoxShape.circle),
            child: const Icon(Icons.check_circle, color: Color(0xFF4CAF50), size: 48),
          ),
          const SizedBox(height: 16),
          Text('Ride Completed!', style: AppTextStyles.h2),
          const SizedBox(height: 8),
          Text('₹${fare.toStringAsFixed(0)}', style: AppTextStyles.price),
          Text('${km.toStringAsFixed(1)} km', style: AppTextStyles.bodySmall),
          const SizedBox(height: 24),
          ElevatedButton(onPressed: onDone, child: const Text('Done')),
        ],
      ),
    );
  }
}
