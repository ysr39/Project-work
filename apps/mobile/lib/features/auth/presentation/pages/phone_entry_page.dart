import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../cubit/auth_cubit.dart';

class PhoneEntryPage extends StatefulWidget {
  const PhoneEntryPage({super.key});

  @override
  State<PhoneEntryPage> createState() => _PhoneEntryPageState();
}

class _PhoneEntryPageState extends State<PhoneEntryPage> {
  final _phoneCtrl = TextEditingController();
  String _selectedRole = 'RIDER';
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _phoneCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<AuthCubit>(),
      child: BlocConsumer<AuthCubit, AuthState>(
        listener: (context, state) {
          if (state is OtpSent) {
            context.push(AppRoutes.otpVerification, extra: {
              'phone': state.phone,
              'role':  state.role,
            });
          }
          if (state is AuthError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message), backgroundColor: AppColors.error),
            );
          }
        },
        builder: (context, state) {
          return Scaffold(
            body: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 40),
                      Text('Welcome to', style: AppTextStyles.body.copyWith(color: AppColors.subtle)),
                      Text('TaxiPool', style: AppTextStyles.h1.copyWith(color: AppColors.primary)),
                      const SizedBox(height: 8),
                      Text('Enter your phone number to get started', style: AppTextStyles.bodySmall),
                      const SizedBox(height: 40),

                      // Role selector
                      Row(
                        children: ['RIDER', 'DRIVER'].map((role) {
                          final selected = _selectedRole == role;
                          return Expanded(
                            child: GestureDetector(
                              onTap: () => setState(() => _selectedRole = role),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                margin: EdgeInsets.only(right: role == 'RIDER' ? 8 : 0),
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                decoration: BoxDecoration(
                                  color: selected ? AppColors.primary : AppColors.surface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: selected ? AppColors.primary : AppColors.border,
                                  ),
                                ),
                                child: Text(
                                  role,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: selected ? Colors.white : AppColors.subtle,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                  ),
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 24),

                      // Phone input
                      TextFormField(
                        controller: _phoneCtrl,
                        keyboardType: TextInputType.phone,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                        decoration: const InputDecoration(
                          prefixText: '+91  ',
                          hintText: '9876543210',
                          labelText: 'Phone Number',
                        ),
                        validator: (v) {
                          if (v == null || v.length < 10) return 'Enter valid phone number';
                          return null;
                        },
                      ),
                      const SizedBox(height: 32),

                      ElevatedButton(
                        onPressed: state is AuthLoading ? null : () {
                          if (_formKey.currentState!.validate()) {
                            context.read<AuthCubit>().sendOtp(
                              phone: '+91${_phoneCtrl.text.trim()}',
                              role:  _selectedRole,
                            );
                          }
                        },
                        child: state is AuthLoading
                            ? const SizedBox(
                                height: 20,
                                width:  20,
                                child:  CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Text('Send OTP'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
