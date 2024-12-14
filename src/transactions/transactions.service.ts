import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { Transaction } from '../dto/create-transaction-dto';
import { IAccountRepository } from '../domain/repositories/account.repository.interface';
import { Account } from '../domain/entities/account.entity';
import { TransactionResult, BatchProcessResult } from './types';

@Injectable()
export class TransactionsService {
  private readonly BATCH_SIZE = 100;

  constructor(
    @Inject('IAccountRepository')
    private readonly accountRepository: IAccountRepository
  ) {}

  async processTransactions(transactions: Transaction[]): Promise<BatchProcessResult> {
    if (transactions.length === 0) {
      throw new BadRequestException('No transactions to process');
    }

    const batches = this.createBatches(transactions);
    const results: TransactionResult[] = [];
    
    for (const batch of batches) {
      try {
        const batchResults = await this.processBatch(batch);
        results.push(...batchResults);
      } catch (error) {
        batch.forEach(transaction => {
          if (!results.some(r => r.transactionId === transaction.id)) {
            results.push({
              success: false,
              transactionId: transaction.id,
              error: error.message || 'Transaction failed due to batch rollback'
            });
          }
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success);

    return {
      successful,
      failed
    };
  }

  private createBatches(transactions: Transaction[]): Transaction[][] {
    const batches: Transaction[][] = [];
    for (let i = 0; i < transactions.length; i += this.BATCH_SIZE) {
      batches.push(transactions.slice(i, i + this.BATCH_SIZE));
    }
    return batches;
  }

  private async processBatch(transactions: Transaction[]): Promise<TransactionResult[]> {
    const results: TransactionResult[] = [];
    const accountMap = new Map<string, Account>();
    const affectedAccountIds = new Set<string>();

    transactions.forEach(({ senderId, recipientId }) => {
      affectedAccountIds.add(senderId);
      affectedAccountIds.add(recipientId);
    });

    try {
      await this.startTransaction();
      await this.loadAccounts(affectedAccountIds, accountMap);
      await this.validateBatch(transactions, accountMap);
      await this.executeBatch(transactions, accountMap, results);
      await this.commitTransaction();
      return results;

    } catch (error) {
      await this.rollbackTransaction();
      return this.handleBatchError(transactions, error);
    }
  }

  private async startTransaction(): Promise<void> {
    await this.accountRepository.beginTransaction();
  }

  private async loadAccounts(affectedAccountIds: Set<string>, accountMap: Map<string, Account>): Promise<void> {
    const accounts = await Promise.all(
      Array.from(affectedAccountIds).map(id => this.accountRepository.findById(id))
    );

    accounts.forEach(account => {
      if (account) {
        accountMap.set(account.id, account);
      }
    });
  }

  private async validateBatch(transactions: Transaction[], accountMap: Map<string, Account>): Promise<void> {
    for (const transaction of transactions) {
      const { senderId, recipientId, amount } = transaction;
      const sender = accountMap.get(senderId);
      const recipient = accountMap.get(recipientId);

      if (!sender || !recipient) {
        throw new Error(`One or more accounts do not exist: ${!sender ? senderId : recipientId}`);
      }

      if (sender.balance < amount) {
        throw new Error(`Insufficient funds in account ${senderId}`);
      }
    }
  }

  private async executeBatch(transactions: Transaction[], accountMap: Map<string, Account>, results: TransactionResult[]): Promise<void> {
    for (const transaction of transactions) {
      const { senderId, recipientId, amount, id } = transaction;
      const sender = accountMap.get(senderId);
      const recipient = accountMap.get(recipientId);

      sender!.balance -= amount;
      recipient!.balance += amount;

      await this.accountRepository.save(sender!);
      await this.accountRepository.save(recipient!);

      results.push({
        success: true,
        transactionId: id
      });
    }
  }

  private async commitTransaction(): Promise<void> {
    await this.accountRepository.commitTransaction();
  }

  private async rollbackTransaction(): Promise<void> {
    await this.accountRepository.rollbackTransaction();
  }

  private handleBatchError(transactions: Transaction[], error: Error): TransactionResult[] {
    let failingTransactionId = transactions[0].id;
    if (error.message.includes('Insufficient funds in account')) {
      const accountId = error.message.split('account ')[1];
      const failingTransaction = transactions.find(t => t.senderId === accountId);
      if (failingTransaction) {
        failingTransactionId = failingTransaction.id;
      }
    } else if (error.message.includes('One or more accounts do not exist')) {
      const accountId = error.message.split(': ')[1];
      const failingTransaction = transactions.find(t => 
        t.senderId === accountId || t.recipientId === accountId
      );
      if (failingTransaction) {
        failingTransactionId = failingTransaction.id;
      }
    }

    return [{
      success: false,
      transactionId: failingTransactionId,
      error: error.message.split(': ')[0] 
    }];
  }

  async createAccount(accountId: string, initialBalance: number): Promise<void> {
    const newAccount = new Account(accountId, initialBalance);
    await this.accountRepository.save(newAccount);
  }

  async getBalance(accountId: string): Promise<number> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new BadRequestException(`Account ${accountId} does not exist`);
    }
    return account.balance;
  }
}
