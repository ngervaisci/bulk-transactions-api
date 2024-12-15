import { Controller, Post, Body, BadRequestException, HttpStatus, Logger } from '@nestjs/common';
import { CreateTransactionDto } from '../dto/create-transaction-dto';
import { TransactionsService } from './transactions.service';
import { BatchValidationError } from '../errors/batch-validation.error';

@Controller('transactions')
export class TransactionsController {
  private readonly logger = new Logger(TransactionsController.name);

  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('validate')
  async validate(@Body() createTransactionDto: CreateTransactionDto) {
    this.logger.debug('Validating transactions:', createTransactionDto.transactions);

    try {
      const result = await this.transactionsService.validateTransactions(createTransactionDto.transactions);

      this.logger.debug('Validation result:', result);

      return {
        valid: result.valid,
        errors: result.errors,
        summary: {
          totalTransactions: createTransactionDto.transactions.length,
          validTransactions: createTransactionDto.transactions.length - result.errors.length,
          invalidTransactions: result.errors.length
        }
      };
    } catch (error) {
      if (error instanceof BatchValidationError) {
        this.logger.debug('Validation failed:', error.errors);
        return {
          valid: false,
          errors: error.errors,
          summary: {
            totalTransactions: createTransactionDto.transactions.length,
            validTransactions: 0,
            invalidTransactions: error.errors.length
          }
        };
      }
      throw error;
    }
  }

  @Post()
  async create(@Body() createTransactionDto: CreateTransactionDto) {
    try {
      this.logger.debug('Processing transactions:', createTransactionDto.transactions);

      const result = await this.transactionsService.processTransactions(createTransactionDto.transactions);
      
      if (result.failed.length > 0) {
        this.logger.error('Failed to process transactions:', result.failed);
        throw new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: result.successful === 0 ? 'All transactions failed' : 'Some transactions failed',
          failedTransactions: result.failed
        });
      }

      this.logger.log('Transactions created successfully');

      return {
        statusCode: HttpStatus.CREATED,
        message: 'Transactions created successfully'
      };
    } catch (error) {
      this.logger.error('Error processing transactions:', error);
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