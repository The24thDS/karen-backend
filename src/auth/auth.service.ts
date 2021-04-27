import * as bcrypt from 'bcrypt';
import User from 'src/types/user';
import { UsersService } from 'src/users/users.service';

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user =
      (await this.usersService.findOne({ email })) ||
      (await this.usersService.findOne({ username: email }));
    const isPassGood: boolean = user
      ? await bcrypt.compare(password, user.password)
      : false;
    if (isPassGood) {
      const { password, ...result } = user;
      return result;
    } else {
      return null;
    }
  }

  async login(user: any) {
    const payload = { username: user.username, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }
}
