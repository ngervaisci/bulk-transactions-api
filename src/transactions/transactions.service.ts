import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transaction } from '../dto/create-transaction-dto';
import { Account } from '../domain/entities/account.entity';
import { BatchProcessResult, ValidationResult, ValidationError } from '../transactions/types';
import { AccountService } from '../accounts/account.service';
import { BatchValidationError } from '../errors/batch-validation.error';

@Injectable()
export class TransactionsService {
  private batchSize: number;

  constructor(
    private readonly accountService: AccountService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {
    this.batchSize = this.configService.get('BATCH_SIZE') || 100;
  }

  async processTransactions(transactions: Transaction[]): Promise<BatchProcessResult> {
    if (transactions.length === 0) {
      return {
        successful: 0,
        failed: []
      };
    }

    this.logTransactionProcessing(transactions);

    try {
      await this.validateTransactions(transactions);
    } catch (error) {
      return this.handleValidationError(error, transactions);
    }

    try {
      await this.accountService.beginTransaction();
      const accountMap = await this.getAccountMap(transactions);
      const batches = this.createBatches(transactions);

      this.logBatchProcessing(batches);

      for (const batch of batches) {
        const validationError = await this.validateBatch(batch, accountMap);
        if (validationError) {
          await this.accountService.rollbackTransaction();
          return validationError;
        }
        await this.executeBatch(batch, accountMap);
      }

      await this.accountService.commitTransaction();
      return {
        successful: transactions.length,
        failed: []
      };
    } catch (error) {
      return this.rollbackTransactionAndReturnError(error, transactions);
    }
  }

  async getBalance(accountId: string): Promise<number> {
    const account = await this.accountService.getAccountById(accountId);
    if (!account) {
      throw new BadRequestException(`Account ${accountId} not found`);
    }
    return account.balance;
  }

  public async validateTransactions(transactions: Transaction[]): Promise<ValidationResult> {
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

    if (errors.length > 0) {
      throw new BatchValidationError(errors);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public async getAccountMap(transactions: Transaction[]): Promise<Map<string, Account>> {
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

    return accountMap;
  }

  private logTransactionProcessing(transactions: Transaction[]): void {
    console.log('Processing transactions:', transactions);
    console.log('Transactions being processed:', transactions.map(t => t.id));
  }

  private logBatchProcessing(batches: Transaction[][]): void {
    console.log(`Processing ${batches.length} batches of size ${this.batchSize}`);
  }

  private async rollbackTransactionAndReturnError(error: any, transactions: Transaction[]): Promise<BatchProcessResult> {
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

  private createBatches(transactions: Transaction[]): Transaction[][] {
    const batches = [];
    for (let i = 0; i < transactions.length; i += this.batchSize) {
      batches.push(transactions.slice(i, i + this.batchSize));
    }
    return batches;
  }

  private async validateBatch(batch: Transaction[], accountMap: Map<string, Account>): Promise<BatchProcessResult | null> {
    for (const transaction of batch) {
      const { senderId, amount } = transaction;
      const sender = accountMap.get(senderId)!;
      if (sender.balance < amount) {
        return {
          successful: 0,
          failed: batch.map(t => ({
            success: false,
            transactionId: t.id,
            error: t.id === transaction.id 
              ? `Insufficient funds in account ${senderId}` 
              : 'Transaction failed due to insufficient funds in another transaction'
          }))
        };
      }
    }
    return null;
  }

  private async executeBatch(batch: Transaction[], accountMap: Map<string, Account>): Promise<void> {
    for (const transaction of batch) {
      const { senderId, recipientId, amount } = transaction;
      const sender = accountMap.get(senderId)!;
      const recipient = accountMap.get(recipientId)!;

      sender.balance -= amount;
      recipient.balance += amount;

      await this.accountService.updateAccount(sender);
      await this.accountService.updateAccount(recipient);
    }
  }

  private async validateBatchWithoutThrow(
    transactions: Transaction[], 
    accountMap: Map<string, Account>
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const transaction of transactions) {
      const { senderId, recipientId, amount, id } = transaction;

      if (amount <= 0) {
        errors.push({
          transactionId: id,
          error: `Invalid transaction amount: ${amount}. Amount must be greater than 0`
        });
        continue;
      }

      if (senderId === recipientId) {
        errors.push({
          transactionId: id,
          error: 'Sender and recipient cannot be the same account'
        });
        continue;
      }

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

  private handleValidationError(error: any, transactions: Transaction[]): BatchProcessResult {
    if (error instanceof BatchValidationError) {
      return {
        successful: 0,
        failed: error.errors.map(e => ({
          success: false,
          transactionId: e.transactionId,
          error: e.error
        }))
      };
    }
    throw error;
  }
}
