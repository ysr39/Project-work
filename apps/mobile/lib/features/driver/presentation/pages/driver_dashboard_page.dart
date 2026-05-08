import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../cubit/driver_cubit.dart';
import '../widgets/trip_request_bottom_sheet.dart';

class DriverDashboardPage extends StatefulWidget {
  const DriverDashboardPage({super.key});

  @override
  State<DriverDashboardPage> createState() => _DriverDashboardPageState();
}

class _DriverDashboardPageState extends State<DriverDashboardPage> {
  GoogleMapController? _mapCtrl;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<DriverCubit>(),
      child: BlocConsumer<DriverCubit, DriverState>(
        listener: (context, state) {
          if (state is DriverTripRequest) {
            _showTripRequestSheet(context, state);
          }
          if (state is DriverEnRoute) {
            context.push(AppRoutes.driverTrip, extra: state.tripId);
          }
          if (state is DriverError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message), backgroundColor: AppColors.error),
            );
          }
        },
        builder: (context, state) {
          final isOnline = state is DriverOnline || state is DriverTripRequest ||
              state is DriverEnRoute || state is DriverArrived || state is DriverInProgress;

          return Scaffold(
            body: Stack(
              children: [
                GoogleMap(
                  initialCameraPosition: const CameraPosition(
                    target: LatLng(28.6139, 77.2090),
                    zoom: 14,
                  ),
                  myLocationEnabled:       true,
                  myLocationButtonEnabled: true,
                  zoomControlsEnabled:     false,
                  onMapCreated: (ctrl) => _mapCtrl = ctrl,
                ),

                // Header overlay
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    color: Colors.white,
                    padding: EdgeInsets.fromLTRB(16, MediaQuery.of(context).padding.top + 8, 16, 12),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('TaxiPool', style: AppTextStyles.h3.copyWith(color: AppColors.primary)),
                              Text(
                                isOnline ? 'You are online' : 'You are offline',
                                style: AppTextStyles.bodySmall.copyWith(
                                  color: isOnline ? AppColors.secondary : AppColors.subtle,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.history),
                          onPressed: () => context.push(AppRoutes.history),
                        ),
                        IconButton(
                          icon: const Icon(Icons.account_balance_wallet_outlined),
                          onPressed: () => context.push(AppRoutes.wallet),
                        ),
                      ],
                    ),
                  ),
                ),

                // Online toggle
                Positioned(
                  bottom: 32,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: BlocBuilder<DriverCubit, DriverState>(
                      builder: (context, state) {
                        final cubit = context.read<DriverCubit>();
                        final online = state is DriverOnline;
                        return GestureDetector(
                          onTap: () => online ? cubit.goOffline() : cubit.goOnline(),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 300),
                            width: 180,
                            height: 56,
                            decoration: BoxDecoration(
                              color: online ? AppColors.secondary : AppColors.primary,
                              borderRadius: BorderRadius.circular(28),
                              boxShadow: [
                                BoxShadow(
                                  color: (online ? AppColors.secondary : AppColors.primary).withOpacity(0.4),
                                  blurRadius: 16,
                                  offset: const Offset(0, 6),
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  online ? Icons.pause_circle_outline : Icons.play_circle_outline,
                                  color: Colors.white,
                                  size: 22,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  online ? 'Go Offline' : 'Go Online',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15,
                                    fontFamily: 'Inter',
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showTripRequestSheet(BuildContext context, DriverTripRequest request) {
    final cubit = context.read<DriverCubit>();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      isDismissible: false,
      builder: (_) => TripRequestBottomSheet(
        request: request,
        onAccept: () {
          Navigator.of(context).pop();
          cubit.acceptTrip(request.tripId);
        },
        onDecline: () {
          Navigator.of(context).pop();
          cubit.declineTrip(request.tripId);
        },
      ),
    );
  }
}
