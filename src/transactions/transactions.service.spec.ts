import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { BadRequestException } from '@nestjs/common';
import { Transaction } from '../dto/create-transaction-dto';
import { IAccountRepository } from '../domain/repositories/account.repository.interface';
import { MockAccountRepository } from '../infrastructure/repositories/mock-account.repository';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let accountRepository: IAccountRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: 'IAccountRepository',
          useClass: MockAccountRepository,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    accountRepository = module.get<IAccountRepository>('IAccountRepository');
  });

  describe('processTransactions', () => {
    it('should successfully process a valid transaction and return success result', async () => {
      const senderId = 'sender1';
      const recipientId = 'recipient1';
      await service.createAccount(senderId, 1000);
      await service.createAccount(recipientId, 0);

      const transaction: Transaction = {
        id: '1',
        amount: 200,
        senderId,
        recipientId,
        status: 'PENDING',
        createdAt: Date.now(),
      };

      const result = await service.processTransactions([transaction]);

      expect(result.successful).toBe(1);
      expect(result.failed).toHaveLength(0);

      expect(await service.getBalance(senderId)).toBe(800);
      expect(await service.getBalance(recipientId)).toBe(200);
    });

    it('should rollback all transactions when one has insufficient funds', async () => {
      const sender1 = 'sender1';
      const sender2 = 'sender2';
      const recipient = 'recipient1';
      
      await service.createAccount(sender1, 1000);
      await service.createAccount(sender2, 50);  
      await service.createAccount(recipient, 0);

      const transactions: Transaction[] = [
        {
          id: '1',
          amount: 200,
          senderId: sender1,
          recipientId: recipient,
          status: 'PENDING',
          createdAt: Date.now(),
        },
        {
          id: '2',
          amount: 100,  
          senderId: sender2,
          recipientId: recipient,
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

      expect(await service.getBalance(sender1)).toBe(1000);
      expect(await service.getBalance(sender2)).toBe(50);
      expect(await service.getBalance(recipient)).toBe(0);
    });

    it('should rollback all transactions when one account does not exist', async () => {
      const sender1 = 'sender1';
      const nonexistentSender = 'nonexistent';
      const recipient = 'recipient1';
      
      await service.createAccount(sender1, 1000);
      await service.createAccount(recipient, 0);

      const transactions: Transaction[] = [
        {
          id: '1',
          amount: 200,
          senderId: sender1,
          recipientId: recipient,
          status: 'PENDING',
          createdAt: Date.now(),
        },
        {
          id: '2',
          amount: 100,
          senderId: nonexistentSender,
          recipientId: recipient,
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
        error: 'One or more accounts do not exist'
      });

      expect(await service.getBalance(sender1)).toBe(1000);
      expect(await service.getBalance(recipient)).toBe(0);
    });
  });
});