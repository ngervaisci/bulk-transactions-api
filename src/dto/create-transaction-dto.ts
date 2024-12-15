import { IsArray, IsNotEmpty, ArrayMaxSize, ArrayNotEmpty, IsString, IsNumber, Min, IsEnum, IsDateString, ValidateNested, IsDefined } from 'class-validator';
import { Type } from 'class-transformer';

export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export class Transaction {
  @IsString()
  @IsNotEmpty({ message: 'Transaction ID is required' })
  id: string;

  @IsNumber()
  @Min(0.01, { message: 'Amount must be greater than 0' })
  @IsDefined({ message: 'Amount is required' })
  amount: number;

  @IsString()
  @IsNotEmpty({ message: 'Sender ID is required' })
  senderId: string;

  @IsString()
  @IsNotEmpty({ message: 'Recipient ID is required' })
  recipientId: string;

  @IsEnum(['PENDING', 'COMPLETED', 'FAILED'], {
    message: 'Status must be either PENDING, COMPLETED, or FAILED'
  })
  status: TransactionStatus;

  @IsNumber()
  @IsDefined({ message: 'Created timestamp is required' })
  createdAt: number;
}

export class CreateTransactionDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Transactions array cannot be empty' })
  @ArrayMaxSize(10000, { message: 'Too many transactions. Maximum allowed is 10000' })
  @ValidateNested({ each: true })
  @Type(() => Transaction)
  transactions: Transaction[];

  constructor(transactions: Transaction[]) {
    this.transactions = transactions;
  }
}