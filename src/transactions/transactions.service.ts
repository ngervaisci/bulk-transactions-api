import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { Transaction } from '../dto/create-transaction-dto';
import { IAccountRepository } from '../domain/repositories/account.repository.interface';
import { Account } from '../domain/entities/account.entity';

@Injectable()
export class TransactionsService {
  private readonly BATCH_SIZE = 100;

  constructor(
    @Inject('IAccountRepository')
    private readonly accountRepository: IAccountRepository
  ) {}

  async processTransactions(transactions: Transaction[]): Promise<void> {
    const batches = this.createBatches(transactions);
    for (const batch of batches) {
      await this.processBatch(batch);
    }
  }

  private createBatches(transactions: Transaction[]): Transaction[][] {
    const batches: Transaction[][] = [];
    for (let i = 0; i < transactions.length; i += this.BATCH_SIZE) {
      batches.push(transactions.slice(i, i + this.BATCH_SIZE));
    }
    return batches;
  }

  private async processBatch(transactions: Transaction[]): Promise<void> {
  await this.accountRepository.executeInTransaction(async () => {
    const affectedAccountIds = new Set<string>();
    transactions.forEach(({ senderId, recipientId }) => {
      affectedAccountIds.add(senderId);
      affectedAccountIds.add(recipientId);
    });

    const accounts = await Promise.all(
      Array.from(affectedAccountIds).map(id => this.accountRepository.findById(id))
    );

    const accountMap = new Map<string, Account>();
    accounts.forEach(account => {
      if (!account) {
        throw new BadRequestException('One or more accounts do not exist');
      }
      accountMap.set(account.id, account);
    });

    transactions.forEach(({ senderId, recipientId, amount }) => {
      const sender = accountMap.get(senderId)!;
      const recipient = accountMap.get(recipientId)!;

      if (sender.balance < amount) {
        throw new BadRequestException(`Insufficient funds in account ${senderId}`);
      }

      sender.balance -= amount;
      recipient.balance += amount;
    });

    await Promise.all(
      Array.from(accountMap.values()).map(account => 
        this.accountRepository.save(account)
      )
    );
  });
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
