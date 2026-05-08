import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { UserRole } from '../../src/common/constants/roles.enum';

export interface AuthTokens {
  accessToken:  string;
  refreshToken: string;
  userId:       string;
}

/**
 * Create a test user by simulating the full OTP flow.
 * OtpService.verify is mocked in tests to return true for any code.
 */
export async function loginAs(
  app: INestApplication,
  phone: string,
  role: UserRole = UserRole.RIDER,
): Promise<AuthTokens> {
  // Step 1: request OTP (always succeeds in test env)
  await request(app.getHttpServer())
    .post('/api/v1/auth/send-otp')
    .send({ phone })
    .expect(200);

  // Step 2: verify with the test magic OTP (000000 bypassed in test environment)
  const verifyRes = await request(app.getHttpServer())
    .post('/api/v1/auth/verify-otp')
    .send({ phone, otp: '000000', role })
    .expect(200);

  const { accessToken, refreshToken, user } = verifyRes.body.data ?? verifyRes.body;

  return { accessToken, refreshToken, userId: user.id };
}

export function bearerHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
