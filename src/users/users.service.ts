import * as bcrypt from 'bcrypt';
import User from 'src/types/user';
import { v4 as uuidv4 } from 'uuid';

import { HttpException, Injectable } from '@nestjs/common';

import { Neo4jOrmService } from '../neo4j-orm/neo4j-orm.service';
import { CreateUserDto } from './dto/crease-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly neo4jOrm: Neo4jOrmService) {}

  async create(createUserDto: CreateUserDto): Promise<any> {
    const id = uuidv4();
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(createUserDto.password, salt);
    try {
      const res = await this.neo4jOrm.createOne('User', {
        ...createUserDto,
        id,
        password: hashedPassword,
      });
      const { password, ...rest } = res;
      return rest;
    } catch (e) {
      console.log(e);
      if (e.message.includes('already exists')) {
        throw new HttpException(
          'An account with this email already exists',
          409,
        );
      } else {
        return e;
      }
    }
  }
  async findOne(id: string, props?): Promise<User | undefined> {
    try {
      const user: User = await this.neo4jOrm.findOne('User', { id, ...props });
      return user;
    } catch (e) {
      return e;
    }
  }
  async findOneByEmail(email: string, props?): Promise<User | undefined> {
    try {
      const user: User = await this.neo4jOrm.findOne('User', {
        email,
        ...props,
      });
      return user;
    } catch (e) {
      return e;
    }
  }
}
