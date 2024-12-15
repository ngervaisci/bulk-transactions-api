import { Injectable } from '@nestjs/common';
import { Account } from '../../domain/entities/account.entity';
import { IAccountRepository } from '../../domain/repositories/account.repository.interface';

@Injectable()
export class MockAccountRepository implements IAccountRepository {
  private accounts: Map<string, Account> = new Map();
  private transactionSnapshot: Map<string, Account> | null = null;

  constructor() {
    this.initializeDummyAccounts();
  }

  private initializeDummyAccounts() {
    const dummyAccounts: Account[] = [
      new Account('1', 1000),
      new Account('2', 2000),
      new Account('3', 3000),
    ];
    dummyAccounts.forEach(account => this.accounts.set(account.id, account));
  }

  async findById(id: string): Promise<Account | null> {
    const account = this.accounts.get(id);
    if (!account) return null;
    return new Account(account.id, account.balance); 
  }

  async save(account: Account): Promise<void> {
    this.accounts.set(account.id, new Account(account.id, account.balance)); 
  }

  async beginTransaction(): Promise<void> {
    // NOTE: Creates a deep copy of the account state 
    this.transactionSnapshot = new Map(
      Array.from(this.accounts.entries()).map(([id, account]) => [id, new Account(account.id, account.balance)])
    );
  }

  async commitTransaction(): Promise<void> {
    this.transactionSnapshot = null;
  }

  async rollbackTransaction(): Promise<void> {
    if (this.transactionSnapshot) {
      // NOTE: Restore the accounts to their original state
      this.accounts = new Map(
        Array.from(this.transactionSnapshot.entries()).map(([id, account]) => [id, new Account(account.id, account.balance)])
      );
      this.transactionSnapshot = null;
    }
  }

  async executeInTransaction<T>(operation: () => Promise<T>): Promise<T> {
    await this.beginTransaction();
    try {
      const result = await operation();
      await this.commitTransaction();
      return result;
    } catch (error) {
      await this.rollbackTransaction();
      throw error;
    }
  }

  async create(id: string, initialBalance: number): Promise<Account> {
    const account = new Account(id, initialBalance);
    await this.save(account);
    return account;
  }

  async findAll(): Promise<Account[]> {
    return Array.from(this.accounts.values()).map(account => new Account(account.id, account.balance));
  }
}
