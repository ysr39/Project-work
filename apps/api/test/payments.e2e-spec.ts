import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { OtpService } from '../src/modules/auth/otp.service';
import { StripeService } from '../src/modules/payments/stripe.service';
import { UserRole } from '../src/common/constants/roles.enum';
import { TripType } from '../src/common/constants/trip-status.enum';

async function loginAs(app: INestApplication, phone: string, role = UserRole.RIDER) {
  const res = await request(app.getHttpServer())
    .post('/api/auth/verify-otp')
    .send({ phone, otp: '000000', role });
  return { token: res.body.accessToken, userId: res.body.user?.id };
}

describe('Payments API (e2e)', () => {
  let app: INestApplication;
  let mockStripe: jest.Mocked<Partial<StripeService>>;

  beforeAll(async () => {
    mockStripe = {
      createOrRetrieveCustomer:  jest.fn().mockResolvedValue({ id: 'cus_test' }),
      createRidePaymentIntent:   jest.fn().mockResolvedValue({ id: 'pi_test', client_secret: 'secret_test' }),
      captureRidePayment:        jest.fn().mockResolvedValue({ id: 'pi_test', latest_charge: 'ch_test' }),
      createWalletTopupIntent:   jest.fn().mockResolvedValue({ id: 'pi_topup', client_secret: 'topup_secret' }),
      constructWebhookEvent:     jest.fn(),
      refundCharge:              jest.fn().mockResolvedValue({ id: 'ref_test' }),
      currency:                  'INR',
    } as any;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(OtpService)
      .useValue({
        generate: jest.fn().mockReturnValue('000000'),
        store:    jest.fn().mockResolvedValue(undefined),
        verify:   jest.fn().mockResolvedValue(true),
      })
      .overrideProvider(StripeService)
      .useValue(mockStripe)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => await app.close());
  afterEach(() => jest.clearAllMocks());

  // ── GET /payments/wallet/balance ──────────────────────────────────────────
  describe('GET /api/payments/wallet/balance', () => {
    it('returns wallet balance for authenticated user', async () => {
      const { token } = await loginAs(app, '+919876502001');

      const res = await request(app.getHttpServer())
        .get('/api/payments/wallet/balance')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const body = res.body.data ?? res.body;
      expect(body).toMatchObject({
        balancePaise:   expect.any(Number),
        balanceDecimal: expect.any(Number),
        currency:       expect.any(String),
      });
    });

    it('returns 401 without auth', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/payments/wallet/balance');
      expect(res.status).toBe(401);
    });
  });

  // ── POST /payments/wallet/topup ───────────────────────────────────────────
  describe('POST /api/payments/wallet/topup', () => {
    it('returns Stripe clientSecret on valid amount', async () => {
      const { token } = await loginAs(app, '+919876502002');

      const res = await request(app.getHttpServer())
        .post('/api/payments/wallet/topup')
        .set('Authorization', `Bearer ${token}`)
        .send({ amountRupees: 500 });

      expect(res.status).toBe(201);
      const body = res.body.data ?? res.body;
      expect(body.clientSecret).toBeDefined();
    });

    it('returns 400 for amount below ₹10', async () => {
      const { token } = await loginAs(app, '+919876502003');

      const res = await request(app.getHttpServer())
        .post('/api/payments/wallet/topup')
        .set('Authorization', `Bearer ${token}`)
        .send({ amountRupees: 5 });

      expect(res.status).toBe(400);
    });

    it('returns 400 for amount above ₹50,000', async () => {
      const { token } = await loginAs(app, '+919876502004');

      const res = await request(app.getHttpServer())
        .post('/api/payments/wallet/topup')
        .set('Authorization', `Bearer ${token}`)
        .send({ amountRupees: 100_000 });

      expect(res.status).toBe(400);
    });
  });

  // ── POST /payments/intent ─────────────────────────────────────────────────
  describe('POST /api/payments/intent', () => {
    it('returns 404 when tripPassengerId does not exist', async () => {
      const { token } = await loginAs(app, '+919876502005');

      const res = await request(app.getHttpServer())
        .post('/api/payments/intent')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tripPassengerId: '00000000-0000-0000-0000-000000000000',
          paymentMethod:   'CARD',
        });

      expect(res.status).toBe(404);
    });

    it('only accessible by RIDER role', async () => {
      const { token: driverToken } = await loginAs(app, '+919876502006', UserRole.DRIVER);

      const res = await request(app.getHttpServer())
        .post('/api/payments/intent')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          tripPassengerId: '00000000-0000-0000-0000-000000000000',
          paymentMethod:   'CARD',
        });

      expect(res.status).toBe(403);
    });
  });

  // ── POST /payments/webhook ────────────────────────────────────────────────
  describe('POST /api/payments/webhook', () => {
    it('returns { received: true } for a valid event', async () => {
      (mockStripe.constructWebhookEvent as jest.Mock).mockReturnValue({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id:             'pi_wh',
            latest_charge:  'ch_wh',
            metadata:       {},
          },
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('stripe-signature', 'sig_test')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ type: 'payment_intent.succeeded' }));

      expect(res.status).toBe(201);
      const body = res.body.data ?? res.body;
      expect(body.received).toBe(true);
    });

    it('returns 400 for invalid Stripe signature', async () => {
      (mockStripe.constructWebhookEvent as jest.Mock).mockImplementation(() => {
        throw new Error('Webhook signature verification failed');
      });

      const res = await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('stripe-signature', 'bad-sig')
        .send('{}');

      expect(res.status).toBe(400);
    });
  });

  // ── GET /payments/history ─────────────────────────────────────────────────
  describe('GET /api/payments/history', () => {
    it('returns paginated payment history for authenticated rider', async () => {
      const { token } = await loginAs(app, '+919876502007');

      const res = await request(app.getHttpServer())
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 5 });

      expect(res.status).toBe(200);
      const body = res.body.data ?? res.body;
      expect(Array.isArray(body.items ?? body)).toBe(true);
    });
  });

  // ── Admin: GET /payments/admin/all ────────────────────────────────────────
  describe('GET /api/payments/admin/all', () => {
    it('returns 403 for non-admin users', async () => {
      const { token } = await loginAs(app, '+919876502008', UserRole.RIDER);

      const res = await request(app.getHttpServer())
        .get('/api/payments/admin/all')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });
});
