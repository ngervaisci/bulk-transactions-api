import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountService } from './account.service';
import { MockAccountRepository } from './repositories/mock-account.repository';

@Module({
  controllers: [AccountsController],
  providers: [
    AccountService,
    {
      provide: 'IAccountRepository',
      useClass: MockAccountRepository,
    },
  ],
  exports: [AccountService],
})
export class AccountsModule {}
