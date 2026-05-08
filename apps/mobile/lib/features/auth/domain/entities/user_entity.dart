import 'package:equatable/equatable.dart';

class UserEntity extends Equatable {
  final String id;
  final String phone;
  final String? fullName;
  final String? email;
  final String? profilePhotoUrl;
  final String role;
  final String status;

  const UserEntity({
    required this.id,
    required this.phone,
    this.fullName,
    this.email,
    this.profilePhotoUrl,
    required this.role,
    required this.status,
  });

  @override
  List<Object?> get props => [id, phone, role, status];
}

class TokenPairEntity extends Equatable {
  final String accessToken;
  final String refreshToken;
  final UserEntity user;

  const TokenPairEntity({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  @override
  List<Object?> get props => [accessToken, user];
}
