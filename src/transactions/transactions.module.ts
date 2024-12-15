import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService],
  imports: [AccountsModule],
})
export class TransactionsModule {}
