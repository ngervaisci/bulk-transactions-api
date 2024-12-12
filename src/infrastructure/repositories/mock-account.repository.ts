import { Injectable } from '@nestjs/common';
import { Account } from '../../domain/entities/account.entity';
import { IAccountRepository } from '../../domain/repositories/account.repository.interface';

@Injectable()
export class MockAccountRepository implements IAccountRepository {
  private accounts: Map<string, Account> = new Map();
  private transactionSnapshot: Map<string, Account> | null = null;

  async findById(id: string): Promise<Account | null> {
    const account = this.accounts.get(id);
    if (!account) return null;
    return new Account(account.id, account.balance); 
  }

  async save(account: Account): Promise<void> {
    this.accounts.set(account.id, new Account(account.id, account.balance)); 
  }

  async beginTransaction(): Promise<void> {
    this.transactionSnapshot = new Map(
      Array.from(this.accounts.entries()).map(([id, account]) => [id, new Account(account.id, account.balance)])
    );
  }

  async commitTransaction(): Promise<void> {
    this.transactionSnapshot = null; 
  }

  async rollbackTransaction(): Promise<void> {
    if (this.transactionSnapshot) {
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
}
