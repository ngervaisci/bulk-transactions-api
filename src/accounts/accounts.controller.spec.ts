import { Test, TestingModule } from '@nestjs/testing';
import { AccountsController } from './accounts.controller';
import { AccountService } from './account.service';
import { CreateAccountDto } from '../dto/create-account-dto';
import { Account } from '../domain/entities/account.entity';
import { BadRequestException } from '@nestjs/common';

describe('AccountsController', () => {
  let controller: AccountsController;
  let service: AccountService;

  const mockAccountService = {
    createAccount: jest.fn(),
    getAccountById: jest.fn(),
    getAllAccounts: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        {
          provide: AccountService,
          useValue: mockAccountService,
        },
      ],
    }).compile();

    controller = module.get<AccountsController>(AccountsController);
    service = module.get<AccountService>(AccountService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new account successfully', async () => {
      const createAccountDto: CreateAccountDto = { 
        id: '1',
        name: 'Test Account',
        balance: 1000 
      };
      const expectedAccount = new Account('1', 1000);
      
      mockAccountService.createAccount.mockResolvedValue(expectedAccount);

      const result = await controller.create(createAccountDto);

      expect(result).toEqual({
        statusCode: 201,
        message: 'Account created successfully',
        account: expectedAccount,
      });
      expect(service.createAccount).toHaveBeenCalledWith(createAccountDto);
    });

    it('should create an account with zero balance', async () => {
      const createAccountDto: CreateAccountDto = { 
        id: '2',
        name: 'Zero Balance Account',
        balance: 0 
      };
      const expectedAccount = new Account('2', 0);
      
      mockAccountService.createAccount.mockResolvedValue(expectedAccount);

      const result = await controller.create(createAccountDto);

      expect(result).toEqual({
        statusCode: 201,
        message: 'Account created successfully',
        account: expectedAccount,
      });
    });

    it('should handle large balance numbers', async () => {
      const createAccountDto: CreateAccountDto = { 
        id: '3',
        name: 'Large Balance Account',
        balance: 999999999999 
      };
      const expectedAccount = new Account('3', 999999999999);
      
      mockAccountService.createAccount.mockResolvedValue(expectedAccount);

      const result = await controller.create(createAccountDto);

      expect(result.account.balance).toBe(999999999999);
    });

    it('should throw BadRequestException when account creation fails', async () => {
      const createAccountDto: CreateAccountDto = { 
        id: '1',
        name: 'Test Account',
        balance: 1000 
      };
      const error = new Error('Creation failed');
      
      mockAccountService.createAccount.mockRejectedValue(error);

      await expect(controller.create(createAccountDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAccount', () => {
    it('should return an account by id successfully', async () => {
      const accountId = '1';
      const expectedAccount = new Account(accountId, 1000);
      
      mockAccountService.getAccountById.mockResolvedValue(expectedAccount);

      const result = await controller.getAccount(accountId);

      expect(result).toEqual(expectedAccount);
      expect(service.getAccountById).toHaveBeenCalledWith(accountId);
    });

    it('should handle special characters in account id', async () => {
      const accountId = 'test-123_456';
      const expectedAccount = new Account(accountId, 1000);
      
      mockAccountService.getAccountById.mockResolvedValue(expectedAccount);

      const result = await controller.getAccount(accountId);

      expect(result).toEqual(expectedAccount);
      expect(service.getAccountById).toHaveBeenCalledWith(accountId);
    });

    it('should throw BadRequestException when account is not found', async () => {
      const accountId = '999';
      
      mockAccountService.getAccountById.mockResolvedValue(null);

      await expect(controller.getAccount(accountId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when service throws error', async () => {
      const accountId = '1';
      const error = new Error('Database error');
      
      mockAccountService.getAccountById.mockRejectedValue(error);

      await expect(controller.getAccount(accountId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAllAccounts', () => {
    it('should return all accounts successfully', async () => {
      const expectedAccounts = [
        new Account('1', 1000),
        new Account('2', 2000),
      ];
      
      mockAccountService.getAllAccounts.mockResolvedValue(expectedAccounts);

      const result = await controller.getAllAccounts();

      expect(result).toEqual(expectedAccounts);
      expect(service.getAllAccounts).toHaveBeenCalled();
    });

    it('should return empty array when no accounts exist', async () => {
      mockAccountService.getAllAccounts.mockResolvedValue([]);

      const result = await controller.getAllAccounts();

      expect(result).toEqual([]);
      expect(service.getAllAccounts).toHaveBeenCalled();
    });

    it('should handle large number of accounts', async () => {
      const largeAccountList = Array.from({ length: 100 }, (_, i) => 
        new Account(String(i + 1), (i + 1) * 1000)
      );
      
      mockAccountService.getAllAccounts.mockResolvedValue(largeAccountList);

      const result = await controller.getAllAccounts();

      expect(result).toHaveLength(100);
      expect(result[99].balance).toBe(100000);
    });

    it('should throw BadRequestException when fetching accounts fails', async () => {
      const error = new Error('Fetch failed');
      
      mockAccountService.getAllAccounts.mockRejectedValue(error);

      await expect(controller.getAllAccounts()).rejects.toThrow(BadRequestException);
    });
  });
});
