import { Controller, Post, Body } from '@nestjs/common';
import { CreateAccountDto } from '../dto/create-account-dto';

@Controller('accounts')
export class AccountsController {
  @Post('create')
  async create(@Body() createAccountDto: CreateAccountDto) {
    return { message: 'Account created successfully', account: createAccountDto };
  }
}
