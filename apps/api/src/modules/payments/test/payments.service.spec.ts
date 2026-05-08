import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';

import { PaymentsService } from '../payments.service';
import { StripeService } from '../stripe.service';
import { WalletService } from '../wallet.service';
import { Payment } from '../entities/payment.entity';
import { TripPassenger } from '../../trips/entities/trip-passenger.entity';
import { User } from '../../users/entities/user.entity';
import { PaymentStatus, PaymentMethod } from '../../../common/constants/trip-status.enum';

const mockRepo = () => ({
  findOne:      jest.fn(),
  find:         jest.fn(),
  save:         jest.fn(),
  create:       jest.fn(),
  update:       jest.fn(),
  findAndCount: jest.fn(),
});

const makePayment = (overrides: Partial<Payment> = {}): Payment => ({
  id:                    'pay-1',
  tripId:                'trip-1',
  tripPassengerId:       'pax-1',
  riderId:               'rider-1',
  amount:                150,
  currency:              'INR',
  paymentMethod:         PaymentMethod.CARD,
  stripePaymentIntentId: 'pi_test',
  stripeChargeId:        'ch_test',
  status:                PaymentStatus.CAPTURED,
  createdAt:             new Date(),
  updatedAt:             new Date(),
  ...overrides,
} as Payment);

describe('PaymentsService', () => {
  let service:     PaymentsService;
  let paymentRepo: ReturnType<typeof mockRepo>;
  let passengerRepo: ReturnType<typeof mockRepo>;
  let userRepo:    ReturnType<typeof mockRepo>;
  let stripeService: jest.Mocked<StripeService>;
  let walletService: jest.Mocked<WalletService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: StripeService,
          useValue: {
            createOrRetrieveCustomer: jest.fn(),
            createRidePaymentIntent:  jest.fn(),
            captureRidePayment:       jest.fn(),
            cancelPaymentIntent:      jest.fn(),
            refundCharge:             jest.fn(),
            constructWebhookEvent:    jest.fn(),
            currency:                 'INR',
          },
        },
        {
          provide: WalletService,
          useValue: {
            initiateTopup: jest.fn(),
            creditFromStripe: jest.fn(),
            creditRefund: jest.fn(),
          },
        },
        { provide: getRepositoryToken(Payment),      useFactory: mockRepo },
        { provide: getRepositoryToken(TripPassenger), useFactory: mockRepo },
        { provide: getRepositoryToken(User),          useFactory: mockRepo },
      ],
    }).compile();

    service      = module.get(PaymentsService);
    paymentRepo  = module.get(getRepositoryToken(Payment));
    passengerRepo = module.get(getRepositoryToken(TripPassenger));
    userRepo     = module.get(getRepositoryToken(User));
    stripeService = module.get(StripeService);
    walletService = module.get(WalletService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── createPaymentIntent ───────────────────────────────────────────────────
  describe('createPaymentIntent', () => {
    it('throws NotFoundException if passenger record is not found', async () => {
      passengerRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createPaymentIntent('rider-1', { tripPassengerId: 'pax-bad', paymentMethod: PaymentMethod.CARD }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if payment already captured', async () => {
      passengerRepo.findOne.mockResolvedValue({ id: 'pax-1', finalFare: 100, tripId: 'trip-1' });
      paymentRepo.findOne.mockResolvedValue(makePayment({ status: PaymentStatus.CAPTURED }));

      await expect(
        service.createPaymentIntent('rider-1', { tripPassengerId: 'pax-1', paymentMethod: PaymentMethod.CARD }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates Stripe intent and persists payment record', async () => {
      passengerRepo.findOne.mockResolvedValue({
        id: 'pax-1', finalFare: 150, tripId: 'trip-1', riderId: 'rider-1',
      });
      paymentRepo.findOne.mockResolvedValue(null);   // no existing payment
      userRepo.findOne.mockResolvedValue({ id: 'rider-1', phone: '+91999', fullName: 'Alice' });
      stripeService.createOrRetrieveCustomer.mockResolvedValue({ id: 'cus_test' } as any);
      stripeService.createRidePaymentIntent.mockResolvedValue({
        id: 'pi_new', client_secret: 'secret_new',
      } as any);

      const newPayment = makePayment({ id: 'pay-new', status: PaymentStatus.PENDING });
      paymentRepo.create.mockReturnValue(newPayment);
      paymentRepo.save.mockResolvedValue(newPayment);

      const result = await service.createPaymentIntent('rider-1', {
        tripPassengerId: 'pax-1',
        paymentMethod: PaymentMethod.CARD,
      });

      expect(result.clientSecret).toBe('secret_new');
      expect(result.paymentId).toBe('pay-new');
      expect(paymentRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  // ── captureOnTripComplete ─────────────────────────────────────────────────
  describe('captureOnTripComplete', () => {
    it('captures all pending payments for a trip', async () => {
      const payment = makePayment({ status: PaymentStatus.PENDING, stripePaymentIntentId: 'pi_pending' });
      paymentRepo.find.mockResolvedValue([payment]);
      stripeService.captureRidePayment.mockResolvedValue({ latest_charge: 'ch_captured' } as any);
      paymentRepo.update.mockResolvedValue({});

      await service.captureOnTripComplete('trip-1');

      expect(stripeService.captureRidePayment).toHaveBeenCalledWith('pi_pending');
      expect(paymentRepo.update).toHaveBeenCalledWith(
        'pay-1',
        expect.objectContaining({ status: PaymentStatus.CAPTURED }),
      );
    });

    it('marks payment as FAILED when Stripe capture throws', async () => {
      const payment = makePayment({ status: PaymentStatus.PENDING, stripePaymentIntentId: 'pi_fail' });
      paymentRepo.find.mockResolvedValue([payment]);
      stripeService.captureRidePayment.mockRejectedValue(new Error('Card declined'));
      paymentRepo.update.mockResolvedValue({});

      await service.captureOnTripComplete('trip-1');

      expect(paymentRepo.update).toHaveBeenCalledWith(
        'pay-1',
        expect.objectContaining({ status: PaymentStatus.FAILED, failedReason: 'Card declined' }),
      );
    });

    it('skips payments without a stripePaymentIntentId', async () => {
      const payment = makePayment({ status: PaymentStatus.PENDING, stripePaymentIntentId: undefined });
      paymentRepo.find.mockResolvedValue([payment]);

      await service.captureOnTripComplete('trip-1');

      expect(stripeService.captureRidePayment).not.toHaveBeenCalled();
    });
  });

  // ── handleWebhook ─────────────────────────────────────────────────────────
  describe('handleWebhook', () => {
    it('throws BadRequestException on invalid signature', async () => {
      stripeService.constructWebhookEvent.mockImplementation(() => {
        throw new Error('Signature mismatch');
      });

      await expect(
        service.handleWebhook(Buffer.from('raw'), 'bad-sig'),
      ).rejects.toThrow(BadRequestException);
    });

    it('credits wallet on wallet_topup succeeded event', async () => {
      stripeService.constructWebhookEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id:              'pi_topup',
            amount_received: 50000,
            latest_charge:   'ch_topup',
            metadata:        { source: 'wallet_topup', walletId: 'wallet-1' },
          },
        },
      } as any);

      await service.handleWebhook(Buffer.from('raw'), 'sig');
      expect(walletService.creditFromStripe).toHaveBeenCalledWith(
        expect.objectContaining({ walletId: 'wallet-1', amountPaise: 50000 }),
      );
    });

    it('updates payment to CAPTURED on ride payment_intent.succeeded', async () => {
      stripeService.constructWebhookEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id:             'pi_ride',
            latest_charge:  'ch_ride',
            metadata:       {},           // no wallet_topup source
          },
        },
      } as any);
      paymentRepo.update.mockResolvedValue({});

      await service.handleWebhook(Buffer.from('raw'), 'sig');

      expect(paymentRepo.update).toHaveBeenCalledWith(
        { stripePaymentIntentId: 'pi_ride' },
        expect.objectContaining({ status: PaymentStatus.CAPTURED }),
      );
    });

    it('marks payment FAILED on payment_intent.payment_failed', async () => {
      stripeService.constructWebhookEvent.mockReturnValue({
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id:                  'pi_fail',
            last_payment_error:  { message: 'Insufficient funds' },
          },
        },
      } as any);
      paymentRepo.update.mockResolvedValue({});

      await service.handleWebhook(Buffer.from('raw'), 'sig');

      expect(paymentRepo.update).toHaveBeenCalledWith(
        { stripePaymentIntentId: 'pi_fail' },
        expect.objectContaining({ status: PaymentStatus.FAILED, failedReason: 'Insufficient funds' }),
      );
    });

    it('returns { received: true } for all events', async () => {
      stripeService.constructWebhookEvent.mockReturnValue({
        type: 'some.unknown.event',
        data: { object: {} },
      } as any);

      const result = await service.handleWebhook(Buffer.from('raw'), 'sig');
      expect(result).toEqual({ received: true });
    });
  });

  // ── refund ────────────────────────────────────────────────────────────────
  describe('refund', () => {
    it('throws NotFoundException for unknown payment', async () => {
      paymentRepo.findOne.mockResolvedValue(null);
      await expect(service.refund('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for non-captured payment', async () => {
      paymentRepo.findOne.mockResolvedValue(makePayment({ status: PaymentStatus.PENDING }));
      await expect(service.refund('pay-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if no charge ID exists', async () => {
      paymentRepo.findOne.mockResolvedValue(makePayment({ stripeChargeId: undefined }));
      await expect(service.refund('pay-1')).rejects.toThrow(BadRequestException);
    });

    it('issues refund and marks payment as REFUNDED', async () => {
      const payment = makePayment();
      paymentRepo.findOne.mockResolvedValue(payment);
      stripeService.refundCharge.mockResolvedValue({ id: 'ref_1' } as any);
      paymentRepo.update.mockResolvedValue({});

      const result = await service.refund('pay-1', { reason: 'Driver no-show' });

      expect(stripeService.refundCharge).toHaveBeenCalledWith(
        expect.objectContaining({ chargeId: 'ch_test' }),
      );
      expect(paymentRepo.update).toHaveBeenCalledWith(
        'pay-1',
        expect.objectContaining({ status: PaymentStatus.REFUNDED, refundReason: 'Driver no-show' }),
      );
      expect(result.refundAmount).toBe(150);
    });

    it('issues partial refund when amountRupees is specified', async () => {
      paymentRepo.findOne.mockResolvedValue(makePayment());
      stripeService.refundCharge.mockResolvedValue({ id: 'ref_partial' } as any);
      paymentRepo.update.mockResolvedValue({});

      const result = await service.refund('pay-1', { amountRupees: 50 });

      expect(stripeService.refundCharge).toHaveBeenCalledWith(
        expect.objectContaining({ amountPaise: 5000 }),
      );
      expect(result.refundAmount).toBe(50);
    });
  });
});
