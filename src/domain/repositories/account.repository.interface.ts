import { Account } from '../entities/account.entity';

export interface IAccountRepository {
  findById(id: string): Promise<Account | null>;
  save(account: Account): Promise<void>;
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
  executeInTransaction<T>(operation: () => Promise<T>): Promise<T>;
}
