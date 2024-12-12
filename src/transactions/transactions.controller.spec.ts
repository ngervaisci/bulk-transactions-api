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
        status: 'PENDING'
      }];
      const dto = new CreateTransactionDto(transactions);

      const result = await controller.create(dto);

      expect(result).toEqual({ message: 'Transactions processed successfully' });
      expect(await service.getBalance(senderId)).toBe(700);
      expect(await service.getBalance(recipientId)).toBe(800);
    });

    it('should throw BadRequestException for invalid transactions', async () => {
      const transactions: Transaction[] = [{
        id: '1',
        amount: 300,
        senderId: 'nonexistent',
        recipientId: 'also-nonexistent',
        status: 'PENDING'
      }];
      const dto = new CreateTransactionDto(transactions);

      await expect(controller.create(dto)).rejects.toThrow(BadRequestException);
    });
  });
});