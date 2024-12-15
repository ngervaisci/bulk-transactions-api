import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { Transaction } from '../dto/create-transaction-dto';
import { Account } from '../domain/entities/account.entity';
import { TransactionResult, BatchProcessResult, ValidationResult, ValidationError } from './types';
import { AccountService } from '../accounts/account.service';

class BatchValidationError extends Error {
  constructor(message: string, public errors: ValidationError[]) {
    super(message);
  }
}

@Injectable()
export class TransactionsService {
  private readonly BATCH_SIZE = 100;

  constructor(
    private readonly accountService: AccountService
  ) {}

  async validateTransactions(transactions: Transaction[]): Promise<ValidationResult> {
    console.log('Validating transactions:', transactions);
    if (transactions.length === 0) {
      return { valid: false, errors: [{ transactionId: '', error: 'No transactions to process' }] };
    }

    const accountMap = new Map<string, Account>();
    const affectedAccountIds = new Set<string>();

    transactions.forEach(({ senderId, recipientId }) => {
      affectedAccountIds.add(senderId);
      affectedAccountIds.add(recipientId);
    });

    for (const id of affectedAccountIds) {
      const account = await this.accountService.getAccountById(id);
      if (account) {
        accountMap.set(account.id, account);
      }
    }

    const errors = await this.validateBatchWithoutThrow(transactions, accountMap);

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private async validateBatchWithoutThrow(
    transactions: Transaction[], 
    accountMap: Map<string, Account>
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const transaction of transactions) {
      const { senderId, recipientId, amount, id } = transaction;
      const sender = accountMap.get(senderId);
      const recipient = accountMap.get(recipientId);

      if (!sender || !recipient) {
        const missingAccounts = [];
        if (!sender) missingAccounts.push(senderId);
        if (!recipient) missingAccounts.push(recipientId);
        errors.push({
          transactionId: id,
          error: `One or more accounts do not exist: ${missingAccounts.join(', ')}`
        });
        continue;
      }

      if (sender.balance < amount) {
        errors.push({
          transactionId: id,
          error: `Insufficient funds in account ${senderId}`
        });
      }
    }

    return errors;
  }

  async processTransactions(transactions: Transaction[]): Promise<BatchProcessResult> {
    if (transactions.length === 0) {
      return {
        successful: 0,
        failed: []
      };
    }

    console.log('Processing transactions:', transactions);
    console.log('Transactions being processed:', transactions.map(t => t.id));

    const validationResult = await this.validateTransactions(transactions);
    if (!validationResult.valid) {
      return {
        successful: 0,
        failed: validationResult.errors.map(error => ({
          success: false,
          transactionId: error.transactionId,
          error: error.error
        }))
      };
    }

    try {
      await this.accountService.beginTransaction();

      const accountMap = new Map<string, Account>();
      const affectedAccountIds = new Set<string>();

      transactions.forEach(({ senderId, recipientId }) => {
        affectedAccountIds.add(senderId);
        affectedAccountIds.add(recipientId);
      });

      for (const id of affectedAccountIds) {
        const account = await this.accountService.getAccountById(id);
        if (account) {
          accountMap.set(account.id, account);
        }
      }

      for (const transaction of transactions) {
        const { senderId, recipientId, amount } = transaction;
        const sender = accountMap.get(senderId)!;
        const recipient = accountMap.get(recipientId)!;

        sender.balance -= amount;
        recipient.balance += amount;

        await this.accountService.updateAccount(sender);
        await this.accountService.updateAccount(recipient);
      }

      await this.accountService.commitTransaction();

      return {
        successful: transactions.length,
        failed: []
      };
    } catch (error) {
      await this.accountService.rollbackTransaction();
      return {
        successful: 0,
        failed: transactions.map(t => ({
          success: false,
          transactionId: t.id,
          error: error instanceof Error ? error.message : 'Transaction processing failed'
        }))
      };
    }
  }

  async getBalance(accountId: string): Promise<number> {
    const account = await this.accountService.getAccountById(accountId);
    if (!account) {
      throw new BadRequestException(`Account ${accountId} not found`);
    }
    return account.balance;
  }
}
