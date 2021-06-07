import { JwtAuthGuard } from './jwt-auth.guard';
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Request,
  UseGuards,
  Get,
} from '@nestjs/common';

import { CreateUserDto } from '../users/dto/crease-user.dto';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Post('register')
  register(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @HttpCode(200)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Get('check-token')
  async checkToken(@Request() req) {
    const user = await this.usersService.findOne({ id: req.user.id });
    return { valid: true, user: { ...req.user, email: user.email } };
  }
}
