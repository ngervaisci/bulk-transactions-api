import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { MockAccountRepository } from '../infrastructure/repositories/mock-account.repository';
import { AccountsController } from '../accounts/accounts.controller';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    {
      provide: 'IAccountRepository',
      useClass: MockAccountRepository,
    },
  ],
  imports: [
    AccountsModule,
  ],
})
export class TransactionsModule {}
