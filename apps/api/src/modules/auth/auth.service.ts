import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { OtpService } from './otp.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { User } from '../users/entities/user.entity';
import { RiderProfile } from '../users/entities/rider-profile.entity';
import { DriverProfile } from '../drivers/entities/driver-profile.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { UserRole, UserStatus } from '../../common/constants/roles.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(RiderProfile) private readonly riderRepo: Repository<RiderProfile>,
    @InjectRepository(DriverProfile) private readonly driverRepo: Repository<DriverProfile>,
    @InjectRepository(RefreshToken) private readonly tokenRepo: Repository<RefreshToken>,
  ) {}

  async sendOtp(dto: SendOtpDto): Promise<{ message: string }> {
    const otp = this.otpService.generate();
    await this.otpService.store(dto.phone, otp);

    // In production: send via Twilio. For dev, log it.
    console.log(`[OTP] ${dto.phone} → ${otp}`);

    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(dto: VerifyOtpDto, deviceInfo?: object) {
    const valid = await this.otpService.verify(dto.phone, dto.otp);
    if (!valid) throw new BadRequestException('Invalid or expired OTP');

    let user = await this.userRepo.findOne({
      where: { phone: dto.phone, deletedAt: null },
    });

    const isNew = !user;
    if (!user) {
      user = this.userRepo.create({
        phone: dto.phone,
        fullName: dto.phone,
        role: dto.role,
        status: UserStatus.ACTIVE,
        isPhoneVerified: true,
      });
      user = await this.userRepo.save(user);

      if (dto.role === UserRole.RIDER) {
        await this.riderRepo.save(this.riderRepo.create({ userId: user.id }));
      }
      if (dto.role === UserRole.DRIVER) {
        await this.driverRepo.save(this.driverRepo.create({ userId: user.id }));
      }
    } else {
      await this.userRepo.update(user.id, { isPhoneVerified: true, lastActiveAt: new Date() });
    }

    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refreshToken, deviceInfo);

    return { ...tokens, isNew, user: this.sanitizeUser(user) };
  }

  async refresh(userId: string, rawToken: string) {
    const tokens = await this.tokenRepo.find({ where: { userId } });
    let matched: RefreshToken | null = null;

    for (const t of tokens) {
      if (await bcrypt.compare(rawToken, t.tokenHash)) {
        matched = t;
        break;
      }
    }

    if (!matched || matched.revokedAt || new Date() > matched.expiresAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.tokenRepo.update(matched.id, { revokedAt: new Date() });
    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(userId, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string, rawToken: string): Promise<void> {
    const tokens = await this.tokenRepo.find({ where: { userId } });
    for (const t of tokens) {
      if (await bcrypt.compare(rawToken, t.tokenHash)) {
        await this.tokenRepo.update(t.id, { revokedAt: new Date() });
        return;
      }
    }
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, phone: user.phone, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get('jwt.secret'),
        expiresIn: this.config.get('jwt.expiresIn'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get('jwt.refreshSecret'),
        expiresIn: this.config.get('jwt.refreshExpiresIn'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, rawToken: string, deviceInfo?: object) {
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.tokenRepo.save(
      this.tokenRepo.create({ userId, tokenHash, expiresAt, deviceInfo }),
    );
  }

  private sanitizeUser(user: User) {
    const { ...safe } = user;
    return safe;
  }
}
