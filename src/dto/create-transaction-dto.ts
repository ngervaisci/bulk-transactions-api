import { IsArray, IsNotEmpty, IsObject, ArrayMaxSize, ArrayNotEmpty, IsString, IsNumber } from 'class-validator';

export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export class CreateTransactionDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Transactions array cannot be empty' })
  @ArrayMaxSize(10000, { message: 'Too many transactions' })
  @IsNotEmpty()
  transactions: Transaction[];

  constructor(transactions: Transaction[]) {
    this.transactions = transactions;
  }
}

export class Transaction {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  senderId: string;

  @IsString()
  @IsNotEmpty()
  recipientId: string;

  @IsNotEmpty()
  status: TransactionStatus;

  @IsNumber()
  @IsNotEmpty()
  createdAt: number;
}