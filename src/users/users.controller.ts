import User from 'src/types/user';

import { Controller, Get, Param } from '@nestjs/common';

import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  private readonly excludedProps = ['password'];

  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.stripExcludedProps(await this.usersService.findOne(id));
  }

  private stripExcludedProps(res: User) {
    this.excludedProps.forEach((p) => delete res[p]);
    return res;
  }
}
