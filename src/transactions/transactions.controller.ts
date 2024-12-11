import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { CreateTransactionDto } from '../dto/create-transaction-dto';

@Controller('transactions')
export class TransactionsController {
  @Post()
  async create(@Body() createTransactionDto: CreateTransactionDto) {
   
    return { message: 'Transactions processed successfully' };
  }
}