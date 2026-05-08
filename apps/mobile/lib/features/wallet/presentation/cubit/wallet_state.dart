part of 'wallet_cubit.dart';

sealed class WalletState extends Equatable {
  @override List<Object?> get props => [];
}
final class WalletInitial extends WalletState {}
final class WalletLoading extends WalletState {}
final class WalletLoaded  extends WalletState {
  final List<Map<String, dynamic>> payments;
  const WalletLoaded(this.payments);
  @override List<Object?> get props => [payments];
}
final class WalletError extends WalletState {
  final String message;
  const WalletError(this.message);
  @override List<Object?> get props => [message];
}
