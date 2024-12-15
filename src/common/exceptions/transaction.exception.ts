import { HttpException, HttpStatus } from '@nestjs/common';

export class TransactionFailedException extends HttpException {
  constructor(failedTransactions: any[]) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Transaction Processing Failed',
        failedTransactions,
        message: 'One or more transactions failed to process',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class AllTransactionsFailedException extends HttpException {
  constructor(failedTransactions: any[]) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'All Transactions Failed',
        failedTransactions,
        message: 'All transactions in the batch failed to process',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
