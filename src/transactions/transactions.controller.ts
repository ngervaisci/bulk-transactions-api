import { Controller, Post, Body, BadRequestException, HttpStatus } from '@nestjs/common';
import { CreateTransactionDto } from '../dto/create-transaction-dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('validate')
  async validate(@Body() createTransactionDto: CreateTransactionDto) {
    const result = await this.transactionsService.validateTransactions(createTransactionDto.transactions);
    return {
      valid: result.valid,
      errors: result.errors,
      summary: {
        totalTransactions: createTransactionDto.transactions.length,
        validTransactions: createTransactionDto.transactions.length - result.errors.length,
        invalidTransactions: result.errors.length
      }
    };
  }

  @Post()
  async create(@Body() createTransactionDto: CreateTransactionDto) {
    try {
      const result = await this.transactionsService.processTransactions(createTransactionDto.transactions);
      
      if (result.failed.length > 0) {
        throw new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: result.successful === 0 ? 'All transactions failed' : 'Some transactions failed',
          failedTransactions: result.failed
        });
      }

      return {
        statusCode: HttpStatus.CREATED,
        message: 'Transactions created successfully'
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Failed to process transactions',
        error: error.message
      });
    }
  }
}