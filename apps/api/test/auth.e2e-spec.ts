import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { OtpService } from '../src/modules/auth/otp.service';
import { UserRole } from '../src/common/constants/roles.enum';

/**
 * Auth e2e tests.
 *
 * OtpService.verify is mocked to accept '000000' so the suite runs
 * without a live Redis connection.
 */
describe('Auth API (e2e)', () => {
  let app: INestApplication;
  let otpService: OtpService;

  const phone = '+919876500001';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(OtpService)
      .useValue({
        generate: jest.fn().mockReturnValue('000000'),
        store:    jest.fn().mockResolvedValue(undefined),
        verify:   jest.fn().mockResolvedValue(true),   // always accept 000000
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    otpService = app.get(OtpService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /auth/send-otp ───────────────────────────────────────────────────
  describe('POST /api/auth/send-otp', () => {
    it('returns 200 with success message', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/send-otp')
        .send({ phone });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ message: 'OTP sent successfully' });
    });

    it('returns 400 for invalid phone format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/send-otp')
        .send({ phone: 'not-a-phone' });

      expect(res.status).toBe(400);
    });
  });

  // ── POST /auth/verify-otp ────────────────────────────────────────────────
  describe('POST /api/auth/verify-otp', () => {
    it('returns tokens and user on valid OTP', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ phone, otp: '000000', role: UserRole.RIDER });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject(
        expect.objectContaining({
          accessToken:  expect.any(String),
          refreshToken: expect.any(String),
          user:         expect.objectContaining({ phone }),
        }),
      );
    });

    it('returns 400 for wrong OTP when mock returns false', async () => {
      // Override verify for this single test
      (otpService.verify as jest.Mock).mockResolvedValueOnce(false);

      const res = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ phone, otp: '999999', role: UserRole.RIDER });

      expect(res.status).toBe(400);
    });

    it('returns 400 for missing role', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ phone, otp: '000000' });    // no role

      expect(res.status).toBe(400);
    });
  });

  // ── POST /auth/refresh ────────────────────────────────────────────────────
  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ phone: '+919876500002', otp: '000000', role: UserRole.RIDER });
      refreshToken = res.body.refreshToken;
    });

    it('returns new tokens for a valid refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        accessToken:  expect.any(String),
        refreshToken: expect.any(String),
      });
    });

    it('returns 401 for a bogus refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'header.payload.bad' });

      expect(res.status).toBe(401);
    });
  });

  // ── Protected route — must include Bearer ────────────────────────────────
  describe('Protected endpoints', () => {
    it('returns 401 when no Authorization header is provided', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/trips');

      expect(res.status).toBe(401);
    });

    it('returns 200 (or non-401) with a valid access token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ phone: '+919876500003', otp: '000000', role: UserRole.RIDER });

      const token = loginRes.body.accessToken;

      const res = await request(app.getHttpServer())
        .get('/api/trips')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).not.toBe(401);
    });
  });
});
