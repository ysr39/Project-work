import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../widgets/quick_action_card.dart';
import '../widgets/recent_trip_tile.dart';

class RiderDashboardPage extends StatelessWidget {
  const RiderDashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('TaxiPool'),
        actions: [
          IconButton(
            icon: const Icon(Icons.history_outlined),
            onPressed: () => context.push(AppRoutes.history),
          ),
          IconButton(
            icon: const Icon(Icons.account_balance_wallet_outlined),
            onPressed: () => context.push(AppRoutes.wallet),
          ),
        ],
      ),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: _GreetingHeader()),
          SliverToBoxAdapter(child: _WhereToCard(onTap: () => context.push(AppRoutes.booking))),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            sliver: SliverToBoxAdapter(
              child: Text('Quick Actions', style: AppTextStyles.h3),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 1.6,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              delegate: SliverChildListDelegate([
                QuickActionCard(
                  icon: Icons.people_alt_outlined,
                  label: 'Pool Ride',
                  subtitle: 'Save up to 35%',
                  color: AppColors.primary,
                  onTap: () => context.push(AppRoutes.booking),
                ),
                QuickActionCard(
                  icon: Icons.schedule_outlined,
                  label: 'Schedule',
                  subtitle: 'Plan ahead',
                  color: AppColors.secondary,
                  onTap: () {},
                ),
                QuickActionCard(
                  icon: Icons.local_offer_outlined,
                  label: 'Offers',
                  subtitle: 'View deals',
                  color: AppColors.warning,
                  onTap: () {},
                ),
                QuickActionCard(
                  icon: Icons.support_agent_outlined,
                  label: 'Support',
                  subtitle: 'Get help',
                  color: AppColors.subtle,
                  onTap: () {},
                ),
              ]),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
            sliver: SliverToBoxAdapter(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Recent Trips', style: AppTextStyles.h3),
                  TextButton(
                    onPressed: () => context.push(AppRoutes.history),
                    child: const Text('See all'),
                  ),
                ],
              ),
            ),
          ),
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (_, i) => RecentTripTile(index: i),
              childCount: 3,
            ),
          ),
          const SliverPadding(padding: EdgeInsets.only(bottom: 24)),
        ],
      ),
    );
  }
}

class _GreetingHeader extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
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
          const Text(
            'Good morning 👋',
            style: TextStyle(color: Colors.white70, fontSize: 14, fontFamily: 'Inter'),
          ),
          const SizedBox(height: 4),
          const Text(
            'Where are you going?',
            style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700, fontFamily: 'Inter'),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Row(
              children: [
                Icon(Icons.search, color: AppColors.subtle, size: 20),
                SizedBox(width: 12),
                Text('Search destination...', style: TextStyle(color: AppColors.subtle, fontFamily: 'Inter')),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _WhereToCard extends StatelessWidget {
  final VoidCallback onTap;
  const _WhereToCard({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2)),
          ],
        ),
        child: const Row(
          children: [
            Icon(Icons.my_location, color: AppColors.primary, size: 20),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Book a pool ride', style: TextStyle(fontWeight: FontWeight.w600, fontFamily: 'Inter')),
                  Text('Tap to enter pickup & drop', style: TextStyle(fontSize: 12, color: AppColors.subtle, fontFamily: 'Inter')),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios, size: 16, color: AppColors.subtle),
          ],
        ),
      ),
    );
  }
}
