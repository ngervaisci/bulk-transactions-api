import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsController } from './transactions.controller';
import { CreateTransactionDto } from '../dto/create-transaction-dto';
import { validate } from 'class-validator';

describe('BulkTransactionsController', () => {
  let controller: TransactionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
    }).compile();

    controller = module.get<TransactionsController>(TransactionsController);
  });

  it('should process transactions successfully', async () => {
    const dto = new CreateTransactionDto([{ id: '1', amount: 100, senderId: "Account1Id", recipientId: "Account2Id" }]);
    expect(await controller.create(dto)).toEqual({ message: 'Transactions processed successfully' });
  });


  it('should throw a validation error for empty transactions', async () => {
    const dto = new CreateTransactionDto([]);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0); 
    
  });

  it('should throw a validation error for too many transactions', async () => {
    const dto = new CreateTransactionDto(Array(10001).fill({ id: '1', amount: 100 }));
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0); 
    expect(errors[0].constraints?.arrayMaxSize).toEqual('Too many transactions');
  });
});