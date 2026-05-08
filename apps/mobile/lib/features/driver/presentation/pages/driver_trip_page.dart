import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../cubit/driver_cubit.dart';

class DriverTripPage extends StatefulWidget {
  final String tripId;
  const DriverTripPage({super.key, required this.tripId});

  @override
  State<DriverTripPage> createState() => _DriverTripPageState();
}

class _DriverTripPageState extends State<DriverTripPage> {
  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: sl<DriverCubit>(),
      child: BlocConsumer<DriverCubit, DriverState>(
        listener: (context, state) {
          if (state is DriverOnline) {
            context.go(AppRoutes.driverDashboard);
          }
        },
        builder: (context, state) {
          return Scaffold(
            body: Stack(
              children: [
                GoogleMap(
                  initialCameraPosition: const CameraPosition(
                    target: LatLng(28.6139, 77.2090),
                    zoom: 15,
                  ),
                  myLocationEnabled: true,
                  zoomControlsEnabled: false,
                ),
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: _DriverActionSheet(state: state, tripId: widget.tripId),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _DriverActionSheet extends StatelessWidget {
  final DriverState state;
  final String tripId;
  const _DriverActionSheet({required this.state, required this.tripId});

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<DriverCubit>();

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 12)],
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
      child: switch (state) {
        DriverEnRoute() => _enRouteContent(context, cubit),
        DriverArrived() => _arrivedContent(context, cubit),
        DriverInProgress() => _inProgressContent(context, cubit),
        _ => const SizedBox.shrink(),
      },
    );
  }

  Widget _enRouteContent(BuildContext context, DriverCubit cubit) => Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const _SheetHandle(),
      const SizedBox(height: 12),
      Text('Heading to pickup', style: AppTextStyles.h3),
      Text('Drive to the pickup location', style: AppTextStyles.bodySmall),
      const SizedBox(height: 20),
      ElevatedButton.icon(
        onPressed: () => cubit.markArrived(tripId),
        icon: const Icon(Icons.location_on),
        label: const Text('I have Arrived'),
      ),
    ],
  );

  Widget _arrivedContent(BuildContext context, DriverCubit cubit) => Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const _SheetHandle(),
      const SizedBox(height: 12),
      Text('Waiting for passengers', style: AppTextStyles.h3),
      Text('Confirm pickup when all aboard', style: AppTextStyles.bodySmall),
      const SizedBox(height: 20),
      ElevatedButton.icon(
        onPressed: () => cubit.pickupPassenger(tripId, 'passenger-id-placeholder'),
        icon: const Icon(Icons.people_alt_outlined),
        label: const Text('Confirm Pickup'),
      ),
    ],
  );

  Widget _inProgressContent(BuildContext context, DriverCubit cubit) => Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const _SheetHandle(),
      const SizedBox(height: 12),
      Text('Ride in progress', style: AppTextStyles.h3),
      Text('Head to the drop-off location', style: AppTextStyles.bodySmall),
      const SizedBox(height: 20),
      ElevatedButton.icon(
        onPressed: () => cubit.dropoffPassenger(tripId, 'passenger-id-placeholder', isFinalStop: true),
        icon: const Icon(Icons.flag_outlined),
        label: const Text('Complete Drop-off'),
        style: ElevatedButton.styleFrom(backgroundColor: AppColors.secondary),
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
