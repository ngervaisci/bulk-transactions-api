import { Controller, Post, Body, BadRequestException, HttpStatus } from '@nestjs/common';
import { CreateTransactionDto } from '../dto/create-transaction-dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  async create(@Body() createTransactionDto: CreateTransactionDto) {
    try {
      const result = await this.transactionsService.processTransactions(createTransactionDto.transactions);
      const failedTransactions = result.failed;

      // Check if there are any failed transactions
      if (result.successful === 0) {
        throw new BadRequestException({ statusCode: HttpStatus.BAD_REQUEST, message: 'All transactions failed', failedTransactions });
      }

      return { statusCode: HttpStatus.CREATED, message: 'Transactions created successfully' };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to process transactions');
    }
  }
}