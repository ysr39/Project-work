import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

import { AuthService } from '../auth.service';
import { OtpService } from '../otp.service';
import { User } from '../../users/entities/user.entity';
import { RiderProfile } from '../../users/entities/rider-profile.entity';
import { DriverProfile } from '../../drivers/entities/driver-profile.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { UserRole, UserStatus } from '../../../common/constants/roles.enum';

// ── Reusable mock repository factory ─────────────────────────────────────────
const mockRepo = () => ({
  findOne: jest.fn(),
  find:    jest.fn(),
  save:    jest.fn(),
  create:  jest.fn(),
  update:  jest.fn(),
});

describe('AuthService', () => {
  let service: AuthService;
  let otpService: jest.Mocked<OtpService>;
  let jwtService: jest.Mocked<JwtService>;
  let userRepo:   ReturnType<typeof mockRepo>;
  let riderRepo:  ReturnType<typeof mockRepo>;
  let driverRepo: ReturnType<typeof mockRepo>;
  let tokenRepo:  ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: OtpService,
          useValue: { generate: jest.fn(), store: jest.fn(), verify: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
        { provide: getRepositoryToken(User),         useFactory: mockRepo },
        { provide: getRepositoryToken(RiderProfile), useFactory: mockRepo },
        { provide: getRepositoryToken(DriverProfile), useFactory: mockRepo },
        { provide: getRepositoryToken(RefreshToken), useFactory: mockRepo },
      ],
    }).compile();

    service    = module.get(AuthService);
    otpService = module.get(OtpService);
    jwtService = module.get(JwtService);
    userRepo   = module.get(getRepositoryToken(User));
    riderRepo  = module.get(getRepositoryToken(RiderProfile));
    driverRepo = module.get(getRepositoryToken(DriverProfile));
    tokenRepo  = module.get(getRepositoryToken(RefreshToken));
  });

  afterEach(() => jest.clearAllMocks());

  // ── sendOtp ───────────────────────────────────────────────────────────────
  describe('sendOtp', () => {
    it('generates, stores, and returns success message', async () => {
      otpService.generate.mockReturnValue('123456');
      otpService.store.mockResolvedValue(undefined);

      const result = await service.sendOtp({ phone: '+919876543210', role: UserRole.RIDER } as any);

      expect(otpService.generate).toHaveBeenCalledTimes(1);
      expect(otpService.store).toHaveBeenCalledWith('+919876543210', '123456');
      expect(result).toEqual({ message: 'OTP sent successfully' });
    });
  });

  // ── verifyOtp ─────────────────────────────────────────────────────────────
  describe('verifyOtp', () => {
    const dto = { phone: '+919876543210', otp: '123456', role: UserRole.RIDER };

    it('throws BadRequestException for invalid OTP', async () => {
      otpService.verify.mockResolvedValue(false);
      await expect(service.verifyOtp(dto)).rejects.toThrow(BadRequestException);
    });

    it('creates a new user + rider profile on first login', async () => {
      otpService.verify.mockResolvedValue(true);
      userRepo.findOne.mockResolvedValue(null);   // user does not exist yet

      const newUser = {
        id: 'user-1',
        phone: dto.phone,
        role: UserRole.RIDER,
        status: UserStatus.ACTIVE,
        isPhoneVerified: true,
      } as User;
      userRepo.create.mockReturnValue(newUser);
      userRepo.save.mockResolvedValue(newUser);
      riderRepo.create.mockReturnValue({});
      riderRepo.save.mockResolvedValue({});
      jwtService.signAsync.mockResolvedValueOnce('access-token')
                          .mockResolvedValueOnce('refresh-token');
      tokenRepo.create.mockReturnValue({});
      tokenRepo.save.mockResolvedValue({});

      const result = await service.verifyOtp(dto);

      expect(userRepo.save).toHaveBeenCalledTimes(1);
      expect(riderRepo.save).toHaveBeenCalledTimes(1);   // rider profile created
      expect(driverRepo.save).not.toHaveBeenCalled();
      expect(result.isNew).toBe(true);
      expect(result.accessToken).toBe('access-token');
    });

    it('creates driver profile when role is DRIVER', async () => {
      otpService.verify.mockResolvedValue(true);
      userRepo.findOne.mockResolvedValue(null);
      const driverUser = { id: 'user-2', role: UserRole.DRIVER } as User;
      userRepo.create.mockReturnValue(driverUser);
      userRepo.save.mockResolvedValue(driverUser);
      driverRepo.create.mockReturnValue({});
      driverRepo.save.mockResolvedValue({});
      jwtService.signAsync.mockResolvedValue('token');
      tokenRepo.create.mockReturnValue({});
      tokenRepo.save.mockResolvedValue({});

      await service.verifyOtp({ ...dto, role: UserRole.DRIVER });

      expect(driverRepo.save).toHaveBeenCalledTimes(1);
      expect(riderRepo.save).not.toHaveBeenCalled();
    });

    it('returns isNew=false for existing user', async () => {
      otpService.verify.mockResolvedValue(true);
      const existingUser = { id: 'user-3', role: UserRole.RIDER } as User;
      userRepo.findOne.mockResolvedValue(existingUser);
      userRepo.update.mockResolvedValue({});
      jwtService.signAsync.mockResolvedValue('token');
      tokenRepo.create.mockReturnValue({});
      tokenRepo.save.mockResolvedValue({});

      const result = await service.verifyOtp(dto);

      expect(result.isNew).toBe(false);
      expect(userRepo.save).not.toHaveBeenCalled();   // no new user created
    });
  });

  // ── refresh ───────────────────────────────────────────────────────────────
  describe('refresh', () => {
    it('throws UnauthorizedException when no matching token exists', async () => {
      tokenRepo.find.mockResolvedValue([]);
      await expect(service.refresh('user-1', 'raw-token'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for revoked token', async () => {
      const storedToken = {
        id: 't-1',
        userId: 'user-1',
        tokenHash: await bcrypt.hash('raw-token', 1),
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 100_000),
      } as unknown as RefreshToken;
      tokenRepo.find.mockResolvedValue([storedToken]);

      await expect(service.refresh('user-1', 'raw-token'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for expired token', async () => {
      const storedToken = {
        id: 't-1',
        tokenHash: await bcrypt.hash('raw-token', 1),
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),   // past
      } as unknown as RefreshToken;
      tokenRepo.find.mockResolvedValue([storedToken]);

      await expect(service.refresh('user-1', 'raw-token'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('rotates tokens successfully on valid refresh', async () => {
      const storedToken = {
        id: 't-1',
        tokenHash: await bcrypt.hash('raw-token', 1),
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100_000),
      } as unknown as RefreshToken;
      tokenRepo.find.mockResolvedValue([storedToken]);
      tokenRepo.update.mockResolvedValue({});
      const user = { id: 'user-1', role: UserRole.RIDER } as User;
      userRepo.findOne.mockResolvedValue(user);
      jwtService.signAsync.mockResolvedValueOnce('new-access')
                          .mockResolvedValueOnce('new-refresh');
      tokenRepo.create.mockReturnValue({});
      tokenRepo.save.mockResolvedValue({});

      const result = await service.refresh('user-1', 'raw-token');

      expect(tokenRepo.update).toHaveBeenCalledWith('t-1', { revokedAt: expect.any(Date) });
      expect((result as any).accessToken).toBe('new-access');
    });
  });
});
