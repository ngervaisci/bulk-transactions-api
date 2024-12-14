import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto, Transaction } from '../dto/create-transaction-dto';
import { BadRequestException } from '@nestjs/common';
import { IAccountRepository } from '../domain/repositories/account.repository.interface';
import { MockAccountRepository } from '../infrastructure/repositories/mock-account.repository';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let service: TransactionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        TransactionsService,
        {
          provide: 'IAccountRepository',
          useClass: MockAccountRepository,
        },
      ],
    }).compile();

    controller = module.get<TransactionsController>(TransactionsController);
    service = module.get<TransactionsService>(TransactionsService);
  });

  describe('create', () => {
    it('should process valid transactions successfully', async () => {
      const senderId = 'sender1';
      const recipientId = 'recipient1';
      await service.createAccount(senderId, 1000);
      await service.createAccount(recipientId, 500);

      const transactions: Transaction[] = [{
        id: '1',
        amount: 300,
        senderId,
        recipientId,
        status: 'PENDING',
        createdAt: Date.now()
      }];
      const dto = new CreateTransactionDto(transactions);

      const result = await controller.create(dto);

      expect(result).toEqual({
        message: 'Transactions created successfully',
        statusCode: 201,
      });
      expect(await service.getBalance(senderId)).toBe(700);
      expect(await service.getBalance(recipientId)).toBe(800);
    });

    it('should handle batch rollback when any transaction fails', async () => {
      const sender1 = 'sender1';
      const sender2 = 'sender2';
      const recipient = 'recipient1';
      
      await service.createAccount(sender1, 1000);
      await service.createAccount(sender2, 100);  // Not enough funds
      await service.createAccount(recipient, 0);

      const transactions: Transaction[] = [
        {
          id: '1',
          amount: 500,
          senderId: sender1,
          recipientId: recipient,
          status: 'PENDING',
          createdAt: Date.now()
        },
        {
          id: '2',
          amount: 200,  // Will fail - insufficient funds
          senderId: sender2,
          recipientId: recipient,
          status: 'PENDING',
          createdAt: Date.now()
        }
      ];
      const dto = new CreateTransactionDto(transactions);

      expect(() => controller.create(dto)).rejects.toThrow(BadRequestException);
      
      // Verify all balances remain unchanged due to rollback
      expect(await service.getBalance(sender1)).toBe(1000);
      expect(await service.getBalance(sender2)).toBe(100);
      expect(await service.getBalance(recipient)).toBe(0);
    });

    it('should handle rollback when an account does not exist', async () => {
      const recipientId = 'recipient1';
      await service.createAccount(recipientId, 0);

      const transactions: Transaction[] = [
        {
          id: '1',
          amount: 100,
          senderId: 'nonexistent1',
          recipientId,
          status: 'PENDING',
          createdAt: Date.now()
        }
      ];
      const dto = new CreateTransactionDto(transactions);

      expect(() => controller.create(dto)).rejects.toThrow(BadRequestException);
      
      // Verify recipient balance remains unchanged
      expect(await service.getBalance(recipientId)).toBe(0);
    });

    it('should handle mixed success and failure cases', async () => {
      const sender1 = 'sender1';
      const sender2 = 'sender2';
      const recipient = 'recipient1';
      
      await service.createAccount(sender1, 1000);
      await service.createAccount(sender2, 100);  // Not enough funds
      await service.createAccount(recipient, 0);

      const transactions: Transaction[] = [
        {
          id: '1',
          amount: 500,
          senderId: sender1,
          recipientId: recipient,
          status: 'PENDING',
          createdAt: Date.now()
        },
        {
          id: '2',
          amount: 200,  // Will fail - insufficient funds
          senderId: sender2,
          recipientId: recipient,
          status: 'PENDING',
          createdAt: Date.now()
        }
      ];
      const dto = new CreateTransactionDto(transactions);

      expect(() => controller.create(dto)).rejects.toThrow(BadRequestException);
      
      // Verify all balances remain unchanged due to rollback
      expect(await service.getBalance(sender1)).toBe(1000);
      expect(await service.getBalance(sender2)).toBe(100);
      expect(await service.getBalance(recipient)).toBe(0);
    });

    it('should handle all failed transactions', async () => {
      const recipientId = 'recipient1';
      await service.createAccount(recipientId, 0);

      const transactions: Transaction[] = [
        {
          id: '1',
          amount: 100,
          senderId: 'nonexistent1',
          recipientId,
          status: 'PENDING',
          createdAt: Date.now()
        }
      ];
      const dto = new CreateTransactionDto(transactions);

      expect(() => controller.create(dto)).rejects.toThrow(BadRequestException);
      
      // Verify recipient balance remains unchanged
      expect(await service.getBalance(recipientId)).toBe(0);
    });

    it('should handle invalid transactions', async () => {
      const transactions: Transaction[] = [{
        id: '1',
        amount: 300,
        senderId: 'nonexistent',
        recipientId: 'also-nonexistent',
        status: 'PENDING',
        createdAt: Date.now()
      }];
      const dto = new CreateTransactionDto(transactions);

      expect(() => controller.create(dto)).rejects.toThrow(BadRequestException);
    });
  });
});