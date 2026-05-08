import '../../domain/entities/user_entity.dart';

class UserModel {
  final String id;
  final String phone;
  final String? fullName;
  final String? email;
  final String? profilePhotoUrl;
  final String role;
  final String status;

  const UserModel({
    required this.id,
    required this.phone,
    this.fullName,
    this.email,
    this.profilePhotoUrl,
    required this.role,
    required this.status,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
        id:              json['id'] as String,
        phone:           json['phone'] as String,
        fullName:        json['fullName'] as String?,
        email:           json['email'] as String?,
        profilePhotoUrl: json['profilePhotoUrl'] as String?,
        role:            json['role'] as String,
        status:          json['status'] as String,
      );

  UserEntity toEntity() => UserEntity(
        id:              id,
        phone:           phone,
        fullName:        fullName,
        email:           email,
        profilePhotoUrl: profilePhotoUrl,
        role:            role,
        status:          status,
      );
}

class TokenPairModel {
  final String accessToken;
  final String refreshToken;
  final UserModel user;

  const TokenPairModel({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  factory TokenPairModel.fromJson(Map<String, dynamic> json) => TokenPairModel(
        accessToken:  json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
        user:         UserModel.fromJson(json['user'] as Map<String, dynamic>),
      );

  TokenPairEntity toEntity() => TokenPairEntity(
        accessToken:  accessToken,
        refreshToken: refreshToken,
        user:         user.toEntity(),
      );
}
