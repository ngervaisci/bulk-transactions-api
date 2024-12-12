import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { CreateTransactionDto } from '../dto/create-transaction-dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  async create(@Body() createTransactionDto: CreateTransactionDto) {
    await this.transactionsService.processTransactions(createTransactionDto.transactions);
    return { message: 'Transactions processed successfully' };
  }
}