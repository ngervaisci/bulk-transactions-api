import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { MockAccountRepository } from '../infrastructure/repositories/mock-account.repository';
import { IAccountRepository } from '../domain/repositories/account.repository.interface';

@Module({
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    {
      provide: 'IAccountRepository',
      useClass: MockAccountRepository,
    },
  ],
})
export class TransactionsModule {}
