import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TransactionsService } from './transactions.service';
import { Transaction } from '../dto/create-transaction-dto';
import { AccountService } from '../accounts/account.service';
import { BatchValidationError } from '../errors/batch-validation.error';
import { Account } from '../domain/entities/account.entity';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let accountService: AccountService;
  let configService: jest.Mocked<ConfigService>;

  const mockAccounts = new Map<string, Account>();

  beforeEach(async () => {
    // Create mock services
    accountService = {
      getAccountById: jest.fn(),
      updateAccount: jest.fn(),
      rollbackTransaction: jest.fn(),
      beginTransaction: jest.fn(),
      commitTransaction: jest.fn()
    } as any;

    configService = {
      get: jest.fn().mockReturnValue(100), // Default batch size
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: AccountService,
          useValue: accountService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);

    // Reset mocks and setup default accounts
    jest.clearAllMocks();
    mockAccounts.clear();

    // Setup mock accounts
    const accounts = [
      { id: 'sender1', balance: 1000 },
      { id: 'recipient1', balance: 0 },
      { id: 'sender2', balance: 50 },
    ];

    accounts.forEach(acc => {
      mockAccounts.set(acc.id, acc as Account);
    });

    (accountService.getAccountById as jest.Mock).mockImplementation(async (id: string) => 
      mockAccounts.get(id) || null
    );

    (accountService.updateAccount as jest.Mock).mockImplementation(async (account: Account) => {
      const existingAccount = mockAccounts.get(account.id);
      if (existingAccount) {
        existingAccount.balance = account.balance;
        mockAccounts.set(account.id, existingAccount);
        return existingAccount;
      }
      return null;
    });
  });

  describe('validateTransactions', () => {
    it('should validate a valid transaction successfully', async () => {
      const transaction: Transaction = {
        id: '1',
        amount: 200,
        senderId: 'sender1',
        recipientId: 'recipient1',
        status: 'PENDING',
        createdAt: Date.now(),
      };

      const result = await service.validateTransactions([transaction]);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(accountService.getAccountById).toHaveBeenCalledWith('sender1');
      expect(accountService.getAccountById).toHaveBeenCalledWith('recipient1');
    });

    it('should throw BatchValidationError for insufficient funds', async () => {
      const transaction: Transaction = {
        id: '1',
        amount: 100,
        senderId: 'sender2',
        recipientId: 'recipient1',
        status: 'PENDING',
        createdAt: Date.now(),
      };

      await expect(service.validateTransactions([transaction])).rejects.toThrow(BatchValidationError);

      try {
        await service.validateTransactions([transaction]);
      } catch (error) {
        expect(error).toBeInstanceOf(BatchValidationError);
        expect(error.errors).toHaveLength(1);
        expect(error.errors[0].transactionId).toBe(transaction.id);
        expect(error.errors[0].error).toBe('Insufficient funds in account sender2');
        expect(error.message).toBe('Validation failed for 1 transactions');
      }
    });

    it('should throw BatchValidationError for missing accounts', async () => {
      const transaction: Transaction = {
        id: '1',
        amount: 200,
        senderId: 'nonexistentSender',
        recipientId: 'recipient1',
        status: 'PENDING',
        createdAt: Date.now(),
      };

      await expect(service.validateTransactions([transaction])).rejects.toThrow(BatchValidationError);

      try {
        await service.validateTransactions([transaction]);
      } catch (error) {
        expect(error).toBeInstanceOf(BatchValidationError);
        expect(error.errors).toHaveLength(1);
        expect(error.errors[0].transactionId).toBe(transaction.id);
        expect(error.errors[0].error).toBe('One or more accounts do not exist: nonexistentSender');
        expect(error.message).toBe('Validation failed for 1 transactions');
      }
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

    it('should handle empty transaction array', async () => {
      const result = await service.processTransactions([]);
      expect(result.successful).toBe(0);
      expect(result.failed).toHaveLength(0);
    });

    it('should process multiple transactions in a batch successfully', async () => {
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
          amount: 300,
          senderId: 'sender1',
          recipientId: 'sender2',
          status: 'PENDING',
          createdAt: Date.now(),
        }
      ];

      const result = await service.processTransactions(transactions);

      expect(result.successful).toBe(2);
      expect(result.failed).toHaveLength(0);

      // Verify final balances
      const sender1 = await accountService.getAccountById('sender1');
      const recipient1 = await accountService.getAccountById('recipient1');
      const sender2 = await accountService.getAccountById('sender2');

      expect(sender1?.balance).toBe(500); // 1000 - 200 - 300
      expect(recipient1?.balance).toBe(200); // 0 + 200
      expect(sender2?.balance).toBe(350); // 50 + 300
    });

    it('should rollback all transactions if one fails', async () => {
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
          amount: 1000, // This will fail as sender2 only has 50
          senderId: 'sender2',
          recipientId: 'recipient1',
          status: 'PENDING',
          createdAt: Date.now(),
        }
      ];

      const result = await service.processTransactions(transactions);

      expect(result.successful).toBe(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toEqual({
        success: false,
        transactionId: '2',
        error: 'Insufficient funds in account sender2'
      });

      // Verify balances remain unchanged
      const sender1 = await accountService.getAccountById('sender1');
      const sender2 = await accountService.getAccountById('sender2');
      const recipient1 = await accountService.getAccountById('recipient1');

      expect(sender1?.balance).toBe(1000);
      expect(sender2?.balance).toBe(50);
      expect(recipient1?.balance).toBe(0);
    });
  });

  describe('getBalance', () => {
    it('should return correct balance for existing account', async () => {
      const balance = await service.getBalance('sender1');
      expect(balance).toBe(1000);
    });

    it('should throw BadRequestException for non-existent account', async () => {
      await expect(service.getBalance('nonexistent')).rejects.toThrow('Account nonexistent not found');
    });
  });

  describe('validateTransactions edge cases', () => {
    it('should reject transaction with negative amount', async () => {
      const transaction: Transaction = {
        id: '1',
        amount: -100,
        senderId: 'sender1',
        recipientId: 'recipient1',
        status: 'PENDING',
        createdAt: Date.now(),
      };

      await expect(service.validateTransactions([transaction])).rejects.toThrow(BatchValidationError);
    });

    it('should reject transaction with zero amount', async () => {
      const transaction: Transaction = {
        id: '1',
        amount: 0,
        senderId: 'sender1',
        recipientId: 'recipient1',
        status: 'PENDING',
        createdAt: Date.now(),
      };

      await expect(service.validateTransactions([transaction])).rejects.toThrow(BatchValidationError);
    });

    it('should reject transaction where sender and recipient are the same', async () => {
      const transaction: Transaction = {
        id: '1',
        amount: 100,
        senderId: 'sender1',
        recipientId: 'sender1',
        status: 'PENDING',
        createdAt: Date.now(),
      };

      await expect(service.validateTransactions([transaction])).rejects.toThrow(BatchValidationError);
    });
  });
});