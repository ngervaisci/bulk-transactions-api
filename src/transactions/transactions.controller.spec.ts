import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto, Transaction } from '../dto/create-transaction-dto';
import { BadRequestException } from '@nestjs/common';
import { MockAccountRepository } from '../accounts/repositories/mock-account-repository';
import { AccountService } from '../accounts/account.service';
import { ConfigService } from '@nestjs/config'; // Add this line

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let service: TransactionsService;
  let accountService: AccountService;
  let accountRepository: MockAccountRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        TransactionsService,
        AccountService,
        ConfigService, // Add this line
        {
          provide: 'IAccountRepository',
          useClass: MockAccountRepository,
        },
      ],
    }).compile();

    controller = module.get<TransactionsController>(TransactionsController);
    service = module.get<TransactionsService>(TransactionsService);
    accountService = module.get<AccountService>(AccountService);
    accountRepository = module.get<MockAccountRepository>('IAccountRepository');

    // Reset the mock repository before each test
    accountRepository.reset();
  });

  describe('create', () => {
    it('should process valid transactions successfully', async () => {
      const senderId = 'sender1';
      const recipientId = 'recipient1';
      await accountService.createAccount({ id: senderId, name: 'Sender 1', balance: 1000 });
      await accountService.createAccount({ id: recipientId, name: 'Recipient 1', balance: 500 });

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
      const senderAccount = await accountService.getAccountById(senderId);
      const recipientAccount = await accountService.getAccountById(recipientId);
      expect(senderAccount).not.toBeNull();
      expect(recipientAccount).not.toBeNull();
      expect(senderAccount!.balance).toBe(700);
      expect(recipientAccount!.balance).toBe(800);
    });

    it('should handle batch rollback when any transaction fails', async () => {
      const sender1 = 'sender1';
      const sender2 = 'sender2';
      const recipient = 'recipient1';
      
      await accountService.createAccount({ id: sender1, name: 'Sender 1', balance: 1000 });
      await accountService.createAccount({ id: sender2, name: 'Sender 2', balance: 100 });  // Not enough funds
      await accountService.createAccount({ id: recipient, name: 'Recipient 1', balance: 0 });

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
          amount: 200, 
          senderId: sender2,
          recipientId: recipient,
          status: 'PENDING',
          createdAt: Date.now()
        }
      ];
      const dto = new CreateTransactionDto(transactions);

      await expect(controller.create(dto)).rejects.toThrow(BadRequestException);
      
      // Verify all balances remain unchanged due to rollback
      const sender1Account = await accountService.getAccountById(sender1);
      const sender2Account = await accountService.getAccountById(sender2);
      const recipientAccount = await accountService.getAccountById(recipient);
      expect(sender1Account).not.toBeNull();
      expect(sender2Account).not.toBeNull();
      expect(recipientAccount).not.toBeNull();
      expect(sender1Account!.balance).toBe(1000);
      expect(sender2Account!.balance).toBe(100);
      expect(recipientAccount!.balance).toBe(0);
    });

    it('should handle rollback when an account does not exist', async () => {
      const recipientId = 'recipient1';
      await accountService.createAccount({ id: recipientId, name: 'Recipient 1', balance: 0 });

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

      await expect(controller.create(dto)).rejects.toThrow(BadRequestException);
      
      const recipientAccount = await accountService.getAccountById(recipientId);
      expect(recipientAccount).not.toBeNull();
      expect(recipientAccount!.balance).toBe(0);
    });

    it('should handle mixed success and failure cases', async () => {
      const sender1 = 'sender1';
      const sender2 = 'sender2';
      const recipient = 'recipient1';
      
      await accountService.createAccount({ id: sender1, name: 'Sender 1', balance: 1000 });
      await accountService.createAccount({ id: sender2, name: 'Sender 2', balance: 100 });  // Not enough funds
      await accountService.createAccount({ id: recipient, name: 'Recipient 1', balance: 0 });

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
          amount: 200,  
          senderId: sender2,
          recipientId: recipient,
          status: 'PENDING',
          createdAt: Date.now()
        }
      ];
      const dto = new CreateTransactionDto(transactions);

      await expect(controller.create(dto)).rejects.toThrow(BadRequestException);
      
      const sender1Account = await accountService.getAccountById(sender1);
      const sender2Account = await accountService.getAccountById(sender2);
      const recipientAccount = await accountService.getAccountById(recipient);
      expect(sender1Account).not.toBeNull();
      expect(sender2Account).not.toBeNull();
      expect(recipientAccount).not.toBeNull();
      expect(sender1Account!.balance).toBe(1000);
      expect(sender2Account!.balance).toBe(100);
      expect(recipientAccount!.balance).toBe(0);
    });

    it('should handle all failed transactions', async () => {
      const recipientId = 'recipient1';
      await accountService.createAccount({ id: recipientId, name: 'Recipient 1', balance: 0 });

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

      await expect(controller.create(dto)).rejects.toThrow(BadRequestException);
      
      const recipientAccount = await accountService.getAccountById(recipientId);
      expect(recipientAccount).not.toBeNull();
      expect(recipientAccount!.balance).toBe(0);
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

      await expect(controller.create(dto)).rejects.toThrow(BadRequestException);
    });
  });
});