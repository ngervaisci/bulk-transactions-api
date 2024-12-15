import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { Transaction } from '../dto/create-transaction-dto';
import { Account } from '../domain/entities/account.entity';
import { AccountService } from '../accounts/account.service';
import { CreateAccountDto } from '../dto/create-account-dto';
import { MockAccountRepository } from '../accounts/repositories/mock-account.repository';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let accountService: AccountService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        AccountService,
        {
          provide: 'IAccountRepository',
          useClass: MockAccountRepository,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    accountService = module.get<AccountService>(AccountService);

    // Create test accounts using AccountService
    await accountService.createAccount({
      id: 'sender1',
      name: 'Sender 1',
      balance: 1000
    });
    await accountService.createAccount({
      id: 'recipient1',
      name: 'Recipient 1',
      balance: 0
    });
    await accountService.createAccount({
      id: 'sender2',
      name: 'Sender 2',
      balance: 50
    });
  });

  describe('validateTransactions', () => {
    it('should validate a valid transaction successfully', async () => {
      const senderId = 'sender1';
      const recipientId = 'recipient1';

      const transaction: Transaction = {
        id: '1',
        amount: 200,
        senderId,
        recipientId,
        status: 'PENDING',
        createdAt: Date.now(),
      };

      const result = await service.validateTransactions([transaction]);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for insufficient funds', async () => {
      const senderId = 'sender2';
      const recipientId = 'recipient1';

      const transaction: Transaction = {
        id: '1',
        amount: 100,
        senderId,
        recipientId,
        status: 'PENDING',
        createdAt: Date.now(),
      };

      const result = await service.validateTransactions([transaction]);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        transactionId: '1',
        error: `Insufficient funds in account ${senderId}`
      });
    });

    it('should return validation errors for non-existent accounts', async () => {
      const senderId = 'nonexistent';
      const recipientId = 'recipient1';

      const transaction: Transaction = {
        id: '1',
        amount: 100,
        senderId,
        recipientId,
        status: 'PENDING',
        createdAt: Date.now(),
      };

      const result = await service.validateTransactions([transaction]);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        transactionId: '1',
        error: `One or more accounts do not exist: ${senderId}`
      });
    });
  });

  describe('processTransactions', () => {
    it('should successfully process a valid transaction and return success result', async () => {
      const senderId = 'sender1';
      const recipientId = 'recipient1';
      const amount = 200;

      const transaction: Transaction = {
        id: '1',
        amount,
        senderId,
        recipientId,
        status: 'PENDING',
        createdAt: Date.now(),
      };

      const result = await service.processTransactions([transaction]);

      expect(result.successful).toBe(1);
      expect(result.failed).toHaveLength(0);

      // Verify account balances after transaction
      const senderAccount = await accountService.getAccountById(senderId);
      const recipientAccount = await accountService.getAccountById(recipientId);

      expect(senderAccount?.balance).toBe(800); // 1000 - 200
      expect(recipientAccount?.balance).toBe(200); // 0 + 200
    });

    it('should fail all transactions when one has insufficient funds', async () => {
      const transactions: Transaction[] = [
        {
          id: '1',
          amount: 200,
          senderId: 'sender1',
          recipientId: 'recipient1',
          status: 'PENDING',
          createdAt: Date.now(),
        },
        {
          id: '2',
          amount: 100,
          senderId: 'sender2',
          recipientId: 'recipient1',
          status: 'PENDING',
          createdAt: Date.now(),
        },
      ];

      const result = await service.processTransactions(transactions);

      expect(result.successful).toBe(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toEqual({
        success: false,
        transactionId: '2',
        error: `Insufficient funds in account sender2`
      });

      // Verify balances are unchanged
      const sender1Account = await accountService.getAccountById('sender1');
      const sender2Account = await accountService.getAccountById('sender2');
      expect(sender1Account?.balance).toBe(1000);
      expect(sender2Account?.balance).toBe(50);
    });

    it('should handle empty transaction array', async () => {
      const result = await service.processTransactions([]);
      expect(result.successful).toBe(0);
      expect(result.failed).toHaveLength(0);
    });
  });
});