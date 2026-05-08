import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:pinput/pinput.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../cubit/auth_cubit.dart';

class OtpVerificationPage extends StatefulWidget {
  final String phone;
  final String role;

  const OtpVerificationPage({
    super.key,
    required this.phone,
    required this.role,
  });

  @override
  State<OtpVerificationPage> createState() => _OtpVerificationPageState();
}

class _OtpVerificationPageState extends State<OtpVerificationPage> {
  final _pinCtrl = TextEditingController();
  int _countdown = 60;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    setState(() => _countdown = 60);
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_countdown > 0) {
        setState(() => _countdown--);
      } else {
        _timer?.cancel();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pinCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final defaultPinTheme = PinTheme(
      width: 56,
      height: 56,
      textStyle: const TextStyle(
        fontSize: 22,
        fontWeight: FontWeight.w700,
        color: AppColors.onSurface,
        fontFamily: 'Inter',
      ),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
    );

    return BlocProvider(
      create: (_) => sl<AuthCubit>(),
      child: BlocConsumer<AuthCubit, AuthState>(
        listener: (context, state) {
          if (state is Authenticated) {
            context.go(
              state.user.role == 'DRIVER'
                  ? AppRoutes.driverDashboard
                  : AppRoutes.riderDashboard,
            );
          }
          if (state is AuthError) {
            _pinCtrl.clear();
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message), backgroundColor: AppColors.error),
            );
          }
        },
        builder: (context, state) {
          return Scaffold(
            appBar: AppBar(title: const Text('Verify OTP')),
            body: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 16),
                  Text('Enter the 6-digit code', style: AppTextStyles.h2),
                  const SizedBox(height: 8),
                  RichText(
                    text: TextSpan(
                      style: AppTextStyles.bodySmall,
                      children: [
                        const TextSpan(text: 'Sent to '),
                        TextSpan(
                          text: widget.phone,
                          style: AppTextStyles.bodySmall.copyWith(
                            fontWeight: FontWeight.w600,
                            color: AppColors.onSurface,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 40),

                  Center(
                    child: Pinput(
                      length: 6,
                      controller: _pinCtrl,
                      defaultPinTheme: defaultPinTheme,
                      focusedPinTheme: defaultPinTheme.copyWith(
                        decoration: defaultPinTheme.decoration!.copyWith(
                          border: Border.all(color: AppColors.primary, width: 2),
                        ),
                      ),
                      onCompleted: (otp) {
                        context.read<AuthCubit>().verifyOtp(
                          phone: widget.phone,
                          otp:   otp,
                          role:  widget.role,
                        );
                      },
                    ),
                  ),

                  const SizedBox(height: 32),

                  if (state is AuthLoading)
                    const Center(child: CircularProgressIndicator()),

                  const SizedBox(height: 24),

                  Center(
                    child: _countdown > 0
                        ? Text(
                            'Resend OTP in ${_countdown}s',
                            style: AppTextStyles.bodySmall,
                          )
                        : TextButton(
                            onPressed: () {
                              context.read<AuthCubit>().sendOtp(
                                phone: widget.phone,
                                role:  widget.role,
                              );
                              _startTimer();
                            },
                            child: const Text('Resend OTP'),
                          ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
