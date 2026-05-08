import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../cubit/rider_cubit.dart';

class BookingPage extends StatefulWidget {
  final String? initialAddress;
  const BookingPage({super.key, this.initialAddress});

  @override
  State<BookingPage> createState() => _BookingPageState();
}

class _BookingPageState extends State<BookingPage> {
  final _pickupCtrl  = TextEditingController();
  final _dropoffCtrl = TextEditingController();

  LatLng? _pickupLatLng;
  LatLng? _dropoffLatLng;
  int     _seats       = 1;
  bool    _locating    = false;
  Map<String, dynamic>? _estimate;

  @override
  void initState() {
    super.initState();
    if (widget.initialAddress != null) {
      _dropoffCtrl.text = widget.initialAddress!;
    }
    _getCurrentLocation();
  }

  @override
  void dispose() {
    _pickupCtrl.dispose();
    _dropoffCtrl.dispose();
    super.dispose();
  }

  Future<void> _getCurrentLocation() async {
    setState(() => _locating = true);
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.deniedForever) return;

      final pos = await Geolocator.getCurrentPosition();
      final placemarks = await placemarkFromCoordinates(pos.latitude, pos.longitude);
      final p = placemarks.first;
      final address = '${p.street}, ${p.locality}';

      setState(() {
        _pickupLatLng = LatLng(pos.latitude, pos.longitude);
        _pickupCtrl.text = address;
      });
    } finally {
      setState(() => _locating = false);
    }
  }

  Future<void> _geocodeDropoff(String address) async {
    try {
      final locs = await locationFromAddress(address);
      if (locs.isNotEmpty) {
        setState(() {
          _dropoffLatLng = LatLng(locs.first.latitude, locs.first.longitude);
        });
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<RiderCubit>(),
      child: BlocListener<RiderCubit, RiderState>(
        listener: (context, state) {
          if (state is RiderWaitingForMatch) {
            context.pushReplacement(AppRoutes.rideTracking, extra: state.trip.id);
          }
          if (state is RiderError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message), backgroundColor: AppColors.error),
            );
          }
        },
        child: Scaffold(
          appBar: AppBar(title: const Text('Book a Ride')),
          body: Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _LocationField(
                        controller: _pickupCtrl,
                        label: 'Pickup',
                        icon: Icons.my_location,
                        iconColor: AppColors.primary,
                        suffix: _locating
                            ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                            : null,
                      ),
                      const SizedBox(height: 12),
                      _LocationField(
                        controller: _dropoffCtrl,
                        label: 'Drop-off',
                        icon: Icons.location_on,
                        iconColor: AppColors.error,
                        onSubmitted: _geocodeDropoff,
                      ),
                      const SizedBox(height: 24),

                      Text('Seats', style: AppTextStyles.h3),
                      const SizedBox(height: 12),
                      Row(
                        children: List.generate(3, (i) {
                          final n = i + 1;
                          return Expanded(
                            child: GestureDetector(
                              onTap: () => setState(() => _seats = n),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 150),
                                margin: EdgeInsets.only(right: i < 2 ? 8 : 0),
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                decoration: BoxDecoration(
                                  color: _seats == n ? AppColors.primary : AppColors.surface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: _seats == n ? AppColors.primary : AppColors.border,
                                  ),
                                ),
                                child: Column(
                                  children: [
                                    Text(
                                      '$n',
                                      style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w700,
                                        color: _seats == n ? Colors.white : AppColors.onSurface,
                                        fontFamily: 'Inter',
                                      ),
                                    ),
                                    Text(
                                      n == 1 ? 'seat' : 'seats',
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: _seats == n ? Colors.white70 : AppColors.subtle,
                                        fontFamily: 'Inter',
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        }),
                      ),

                      if (_estimate != null) ...[
                        const SizedBox(height: 24),
                        _FareEstimateCard(estimate: _estimate!),
                      ],
                    ],
                  ),
                ),
              ),
              _BottomActionBar(
                pickupLatLng:  _pickupLatLng,
                dropoffLatLng: _dropoffLatLng,
                pickupAddress:  _pickupCtrl.text,
                dropoffAddress: _dropoffCtrl.text,
                seats:          _seats,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LocationField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final IconData icon;
  final Color iconColor;
  final Widget? suffix;
  final void Function(String)? onSubmitted;

  const _LocationField({
    required this.controller,
    required this.label,
    required this.icon,
    required this.iconColor,
    this.suffix,
    this.onSubmitted,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, color: iconColor, size: 20),
        suffixIcon: suffix,
      ),
      onSubmitted: onSubmitted,
    );
  }
}

class _FareEstimateCard extends StatelessWidget {
  final Map<String, dynamic> estimate;
  const _FareEstimateCard({required this.estimate});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primary.withOpacity(0.05),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.primary.withOpacity(0.2)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Estimated Fare', style: AppTextStyles.label),
              Text('₹${estimate['poolFare'] ?? '--'}', style: AppTextStyles.price),
              Text('vs ₹${estimate['soloFare'] ?? '--'} solo', style: AppTextStyles.bodySmall),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('Distance', style: AppTextStyles.label),
              Text('${estimate['distanceKm'] ?? '--'} km', style: AppTextStyles.h3),
              Text('~${estimate['etaMin'] ?? '--'} min', style: AppTextStyles.bodySmall),
            ],
          ),
        ],
      ),
    );
  }
}

class _BottomActionBar extends StatelessWidget {
  final LatLng? pickupLatLng;
  final LatLng? dropoffLatLng;
  final String pickupAddress;
  final String dropoffAddress;
  final int seats;

  const _BottomActionBar({
    required this.pickupLatLng,
    required this.dropoffLatLng,
    required this.pickupAddress,
    required this.dropoffAddress,
    required this.seats,
  });

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<RiderCubit>();
    final ready = pickupLatLng != null && dropoffLatLng != null;

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: BlocBuilder<RiderCubit, RiderState>(
        builder: (context, state) {
          return ElevatedButton.icon(
            onPressed: ready && state is! RiderSearching
                ? () => cubit.requestRide(
                      pickupAddress:  pickupAddress,
                      pickup:         pickupLatLng!,
                      dropoffAddress: dropoffAddress,
                      dropoff:        dropoffLatLng!,
                      seats:          seats,
                    )
                : null,
            icon: state is RiderSearching
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Icon(Icons.people_alt_outlined),
            label: Text(state is RiderSearching ? 'Finding your pool...' : 'Book Pool Ride'),
          );
        },
      ),
    );
  }
}
