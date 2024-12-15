import { Controller, Post, Get, Body, Param, HttpStatus, BadRequestException } from '@nestjs/common';
import { CreateAccountDto } from '../dto/create-account-dto';
import { AccountService } from './account.service';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountService: AccountService) {}

  @Post()
  async create(@Body() createAccountDto: CreateAccountDto) {
    try {
      const account = await this.accountService.createAccount(createAccountDto);
      return {
        statusCode: HttpStatus.CREATED,
        message: 'Account created successfully',
        account,
      };
    } catch (error) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Failed to create account',
        error: error.message,
      });
    }
  }

  @Get()
  async getAllAccounts() {
    try {
      const accounts = await this.accountService.getAllAccounts();
      return accounts;
    } catch (error) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Failed to fetch accounts',
        error: error.message,
      });
    }
  }

  @Get(':id')
  async getAccount(@Param('id') id: string) {
    try {
      const account = await this.accountService.getAccountById(id);
      if (!account) {
        throw new BadRequestException({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Account not found',
        });
      }
      return account;
    } catch (error) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Failed to fetch account',
        error: error.message,
      });
    }
  }
}
