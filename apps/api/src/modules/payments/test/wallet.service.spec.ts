import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { WalletService } from '../wallet.service';
import { StripeService } from '../stripe.service';
import { Wallet } from '../entities/wallet.entity';
import { WalletTransaction, WalletTxType } from '../entities/wallet-transaction.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find:    jest.fn(),
  save:    jest.fn(),
  create:  jest.fn(),
  update:  jest.fn(),
  findAndCount: jest.fn(),
});

const makeWallet = (overrides: Partial<Wallet> = {}): Wallet => ({
  id:           'wallet-1',
  userId:       'user-1',
  balancePaise: 10000,   // ₹100
  currency:     'INR',
  isFrozen:     false,
  version:      1,
  createdAt:    new Date(),
  updatedAt:    new Date(),
  get balanceDecimal() { return this.balancePaise / 100; },
  ...overrides,
} as Wallet);

describe('WalletService', () => {
  let service:    WalletService;
  let walletRepo: ReturnType<typeof mockRepo>;
  let txRepo:     ReturnType<typeof mockRepo>;
  let stripeService: jest.Mocked<StripeService>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    // DataSource mock that calls the transaction callback with a mock EntityManager
    const mockEm = {
      findOne: jest.fn(),
      save:    jest.fn(),
      create:  jest.fn(),
    } as unknown as EntityManager;

    dataSource = {
      transaction: jest.fn().mockImplementation((cb: any) => cb(mockEm)),
    } as unknown as jest.Mocked<DataSource>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: getRepositoryToken(Wallet),            useFactory: mockRepo },
        { provide: getRepositoryToken(WalletTransaction), useFactory: mockRepo },
        { provide: StripeService, useValue: { createWalletTopupIntent: jest.fn(), currency: 'INR' } },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service    = module.get(WalletService);
    walletRepo = module.get(getRepositoryToken(Wallet));
    txRepo     = module.get(getRepositoryToken(WalletTransaction));
    stripeService = module.get(StripeService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── getOrCreate ───────────────────────────────────────────────────────────
  describe('getOrCreate', () => {
    it('returns existing wallet', async () => {
      const wallet = makeWallet();
      walletRepo.findOne.mockResolvedValue(wallet);
      await expect(service.getOrCreate('user-1')).resolves.toEqual(wallet);
      expect(walletRepo.save).not.toHaveBeenCalled();
    });

    it('creates wallet if none exists', async () => {
      walletRepo.findOne.mockResolvedValue(null);
      const newWallet = makeWallet();
      walletRepo.create.mockReturnValue(newWallet);
      walletRepo.save.mockResolvedValue(newWallet);

      await expect(service.getOrCreate('user-1')).resolves.toEqual(newWallet);
      expect(walletRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  // ── getBalance ────────────────────────────────────────────────────────────
  describe('getBalance', () => {
    it('returns balance in paise and decimal', async () => {
      walletRepo.findOne.mockResolvedValue(makeWallet({ balancePaise: 50000 }));
      walletRepo.save.mockImplementation(async (w) => w);
      walletRepo.create.mockImplementation((w) => w);

      const result = await service.getBalance('user-1');

      expect(result.balancePaise).toBe(50000);
      expect(result.balanceDecimal).toBe(500);
      expect(result.currency).toBe('INR');
    });
  });

  // ── initiateTopup ─────────────────────────────────────────────────────────
  describe('initiateTopup', () => {
    it('throws if amount is below ₹10', async () => {
      await expect(service.initiateTopup('user-1', 5)).rejects.toThrow(BadRequestException);
    });

    it('throws if amount is above ₹50,000', async () => {
      await expect(service.initiateTopup('user-1', 60_000)).rejects.toThrow(BadRequestException);
    });

    it('throws if wallet is frozen', async () => {
      walletRepo.findOne.mockResolvedValue(makeWallet({ isFrozen: true }));
      walletRepo.create.mockImplementation((w) => w);
      walletRepo.save.mockImplementation(async (w) => w);

      await expect(service.initiateTopup('user-1', 500)).rejects.toThrow(BadRequestException);
    });

    it('returns clientSecret from Stripe on success', async () => {
      walletRepo.findOne.mockResolvedValue(makeWallet());
      stripeService.createWalletTopupIntent.mockResolvedValue({
        id:            'pi_test',
        client_secret: 'secret_abc',
      } as any);

      const result = await service.initiateTopup('user-1', 500);

      expect(result.clientSecret).toBe('secret_abc');
      expect(result.paymentIntentId).toBe('pi_test');
    });
  });

  // ── debitForRide ──────────────────────────────────────────────────────────
  describe('debitForRide', () => {
    const opts = { userId: 'user-1', amountRupees: 50, tripId: 'trip-1', passengerId: 'pax-1' };

    it('is idempotent — returns existing tx if idempotencyKey exists', async () => {
      const existingTx = { id: 'tx-1', idempotencyKey: `ride-debit-${opts.passengerId}` } as WalletTransaction;
      txRepo.findOne.mockResolvedValue(existingTx);

      const result = await service.debitForRide(opts);

      expect(result).toEqual(existingTx);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for insufficient balance', async () => {
      txRepo.findOne.mockResolvedValue(null);

      const mockEm = {
        findOne: jest.fn().mockResolvedValue(makeWallet({ balancePaise: 1000 })),   // only ₹10
        save:    jest.fn(),
        create:  jest.fn(),
      };
      (dataSource.transaction as jest.Mock).mockImplementation((cb: any) => cb(mockEm));

      // Trying to debit ₹50 from ₹10 wallet
      await expect(service.debitForRide(opts)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for frozen wallet', async () => {
      txRepo.findOne.mockResolvedValue(null);

      const mockEm = {
        findOne: jest.fn().mockResolvedValue(makeWallet({ isFrozen: true, balancePaise: 100000 })),
        save:    jest.fn(),
        create:  jest.fn(),
      };
      (dataSource.transaction as jest.Mock).mockImplementation((cb: any) => cb(mockEm));

      await expect(service.debitForRide(opts)).rejects.toThrow(BadRequestException);
    });

    it('deducts balance and records transaction on success', async () => {
      txRepo.findOne.mockResolvedValue(null);
      const wallet = makeWallet({ balancePaise: 10000 });   // ₹100
      const tx = { id: 'tx-new', type: WalletTxType.RIDE_DEBIT } as WalletTransaction;

      const mockEm = {
        findOne: jest.fn().mockResolvedValue(wallet),
        save:    jest.fn().mockResolvedValueOnce(wallet).mockResolvedValueOnce(tx),
        create:  jest.fn().mockReturnValue(tx),
      };
      (dataSource.transaction as jest.Mock).mockImplementation((cb: any) => cb(mockEm));

      const result = await service.debitForRide(opts);

      expect(mockEm.save).toHaveBeenCalledTimes(2);   // wallet + tx
      expect(result.type).toBe(WalletTxType.RIDE_DEBIT);
    });
  });

  // ── creditRefund ──────────────────────────────────────────────────────────
  describe('creditRefund', () => {
    const opts = { userId: 'user-1', amountRupees: 50, tripId: 'trip-1', paymentId: 'pay-1' };

    it('is idempotent — returns existing tx if key exists', async () => {
      const existingTx = { id: 'tx-refund-1' } as WalletTransaction;
      txRepo.findOne.mockResolvedValue(existingTx);

      const result = await service.creditRefund(opts);
      expect(result).toEqual(existingTx);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('credits wallet and records REFUND_CREDIT transaction', async () => {
      txRepo.findOne.mockResolvedValue(null);
      const wallet = makeWallet({ balancePaise: 5000 });
      const tx = { id: 'tx-r', type: WalletTxType.REFUND_CREDIT } as WalletTransaction;

      const mockEm = {
        findOne: jest.fn().mockResolvedValue(wallet),
        save:    jest.fn().mockResolvedValueOnce(wallet).mockResolvedValueOnce(tx),
        create:  jest.fn().mockReturnValue(tx),
      };
      (dataSource.transaction as jest.Mock).mockImplementation((cb: any) => cb(mockEm));

      const result = await service.creditRefund(opts);
      expect(result.type).toBe(WalletTxType.REFUND_CREDIT);
    });
  });
});
