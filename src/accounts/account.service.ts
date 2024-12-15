import { Injectable } from '@nestjs/common';
import { CreateAccountDto } from '../dto/create-account-dto';
import { MockAccountRepository } from './repositories/mock-account.repository';
import { Account } from '../domain/entities/account.entity';

@Injectable()
export class AccountService {
  private accountRepository = new MockAccountRepository();

  async createAccount(createAccountDto: CreateAccountDto) {
    return this.accountRepository.create(createAccountDto.id, createAccountDto.balance);
  }

  async getAccountById(id: string) {
    return this.accountRepository.findById(id);
  }

  async getAllAccounts() {
    return this.accountRepository.findAll();
  }

  async updateAccount(account: Account) {
    await this.accountRepository.save(account);
  }

  async beginTransaction() {
    await this.accountRepository.beginTransaction();
  }

  async commitTransaction() {
    await this.accountRepository.commitTransaction();
  }

  async rollbackTransaction() {
    await this.accountRepository.rollbackTransaction();
  }
}
