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
    it('should successfully process a valid transaction', async () => {
      const senderId = 'sender1';
      const recipientId = 'recipient1';
      await service.createAccount(senderId, 1000);
      await service.createAccount(recipientId, 500);

      const transaction: Transaction = {
        id: 'tx1',
        amount: 500,
        senderId,
        recipientId,
        status: 'PENDING'
      };

      await service.processTransactions([transaction]);

      expect(await service.getBalance(senderId)).toBe(500);
      expect(await service.getBalance(recipientId)).toBe(1000);
    });

    it('should process multiple transactions in order', async () => {
      const sender1 = 'sender1';
      const sender2 = 'sender2';
      const recipient = 'recipient1';
      
      await service.createAccount(sender1, 1000);
      await service.createAccount(sender2, 500);
      await service.createAccount(recipient, 0);

      const transactions: Transaction[] = [
        {
          id: '1',
          amount: 300,
          senderId: sender1,
          recipientId: recipient,
          status: 'PENDING'
        },
        {
          id: '2',
          amount: 200,
          senderId: sender2,
          recipientId: recipient,
          status: 'PENDING'
        },
      ];

      await service.processTransactions(transactions);

      expect(await service.getBalance(sender1)).toBe(700);
      expect(await service.getBalance(sender2)).toBe(300);
      expect(await service.getBalance(recipient)).toBe(500);
    });

    it('should throw error for non-existent sender account', async () => {
      const recipientId = 'recipient1';
      await service.createAccount(recipientId, 0);

      const transaction: Transaction = {
        id: '1',
        amount: 100,
        senderId: 'nonexistent',
        recipientId,
        status: 'PENDING'
      };

      await expect(service.processTransactions([transaction]))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should throw error for insufficient funds', async () => {
      const senderId = 'sender1';
      const recipientId = 'recipient1';
      await service.createAccount(senderId, 50);
      await service.createAccount(recipientId, 0);

      const transaction: Transaction = {
        id: '1',
        amount: 100,
        senderId,
        recipientId,
        status: 'PENDING'
      };

      await expect(service.processTransactions([transaction]))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should throw an error if sender has insufficient funds', async () => {
      const senderId = 'sender1';
      const recipientId = 'recipient1';
      await service.createAccount(senderId, 100);
      await service.createAccount(recipientId, 500);

      const transaction: Transaction = {
        id: '2',
        amount: 200,
        senderId,
        recipientId,
        status: 'PENDING'
      };

      await expect(service.processTransactions([transaction])).rejects.toThrow(BadRequestException);
    });

    it('should throw an error if sender or recipient does not exist', async () => {
      const transaction: Transaction = {
        id: '3',
        amount: 100,
        senderId: 'nonexistentSender',
        recipientId: 'recipient1',
        status: 'PENDING'
      };

      await expect(service.processTransactions([transaction])).rejects.toThrow(BadRequestException);
    });
  });
});