import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/theme/app_theme.dart';
import '../cubit/wallet_cubit.dart';

class WalletPage extends StatelessWidget {
  const WalletPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<WalletCubit>()..loadHistory(),
      child: Scaffold(
        appBar: AppBar(title: const Text('Wallet & Payments')),
        body: BlocBuilder<WalletCubit, WalletState>(
          builder: (context, state) {
            return CustomScrollView(
              slivers: [
                SliverToBoxAdapter(child: _BalanceCard()),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  sliver: SliverToBoxAdapter(
                    child: Text('Transaction History', style: AppTextStyles.h3),
                  ),
                ),
                switch (state) {
                  WalletLoading() => const SliverFillRemaining(
                      child: Center(child: CircularProgressIndicator()),
                    ),
                  WalletLoaded(:final payments) when payments.isEmpty =>
                    const SliverFillRemaining(
                      child: Center(child: Text('No transactions yet')),
                    ),
                  WalletLoaded(:final payments) => SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) => _PaymentTile(payment: payments[i]),
                        childCount: payments.length,
                      ),
                    ),
                  WalletError(:final message) => SliverFillRemaining(
                      child: Center(child: Text(message, style: const TextStyle(color: AppColors.error))),
                    ),
                  _ => const SliverToBoxAdapter(child: SizedBox.shrink()),
                },
                const SliverPadding(padding: EdgeInsets.only(bottom: 24)),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Available Balance', style: TextStyle(color: Colors.white70, fontSize: 14, fontFamily: 'Inter')),
          const SizedBox(height: 8),
          const Text('₹0.00', style: TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w700, fontFamily: 'Inter')),
          const SizedBox(height: 20),
          Row(
            children: [
              _CardAction(icon: Icons.add, label: 'Add Money', onTap: () {}),
              const SizedBox(width: 12),
              _CardAction(icon: Icons.download_outlined, label: 'Withdraw', onTap: () {}),
            ],
          ),
        ],
      ),
    );
  }
}

class _CardAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _CardAction({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.15),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: Colors.white, size: 18),
              const SizedBox(width: 6),
              Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13, fontFamily: 'Inter')),
            ],
          ),
        ),
      ),
    );
  }
}

class _PaymentTile extends StatelessWidget {
  final Map<String, dynamic> payment;
  const _PaymentTile({required this.payment});

  @override
  Widget build(BuildContext context) {
    final amount   = (payment['amount'] as num?)?.toDouble() ?? 0;
    final status   = payment['status'] as String? ?? '';
    final date     = payment['createdAt'] != null
        ? DateTime.tryParse(payment['createdAt'] as String) ?? DateTime.now()
        : DateTime.now();
    final isRefund = status == 'REFUNDED';

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: isRefund ? Colors.green.withOpacity(0.1) : AppColors.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isRefund ? Icons.arrow_downward : Icons.arrow_upward,
              color: isRefund ? Colors.green : AppColors.primary,
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  payment['tripId'] != null ? 'Trip Payment' : 'Wallet Topup',
                  style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14, fontFamily: 'Inter'),
                ),
                Text(
                  DateFormat('dd MMM yyyy, hh:mm a').format(date),
                  style: AppTextStyles.bodySmall,
                ),
              ],
            ),
          ),
          Text(
            '${isRefund ? '+' : '-'}₹${amount.toStringAsFixed(0)}',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 15,
              color: isRefund ? Colors.green : AppColors.onSurface,
              fontFamily: 'Inter',
            ),
          ),
        ],
      ),
    );
  }
}
