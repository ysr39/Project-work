part of 'auth_cubit.dart';

sealed class AuthState extends Equatable {
  @override
  List<Object?> get props => [];
}

final class AuthInitial extends AuthState {}

final class AuthLoading extends AuthState {}

final class OtpSent extends AuthState {
  final String phone;
  final String role;
  const OtpSent({required this.phone, required this.role});

  @override
  List<Object?> get props => [phone, role];
}

final class Authenticated extends AuthState {
  final UserEntity user;
  const Authenticated(this.user);

  @override
  List<Object?> get props => [user];
}

final class AuthError extends AuthState {
  final String message;
  const AuthError(this.message);

  @override
  List<Object?> get props => [message];
}
