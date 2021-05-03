import * as bcrypt from 'bcrypt';
import { node, Query } from 'cypher-query-builder';
import { Neo4jService } from 'nest-neo4j/dist';
import { formatDate, parseRecord } from 'src/utils/neo4j-utils';
import { v4 as uuidv4 } from 'uuid';

import { HttpException, Injectable } from '@nestjs/common';

import { CreateUserDto } from './dto/crease-user.dto';
import { User } from './interfaces/user.interface';

@Injectable()
export class UsersService {
  constructor(private readonly neo4jService: Neo4jService) {}

  async create(createUserDto: CreateUserDto): Promise<any> {
    const id = uuidv4();
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(createUserDto.password, salt);
    const userProps = {
      ...createUserDto,
      id,
      password: hashedPassword,
    };
    const q = new Query()
      .create([node('user', 'User', userProps)])
      .raw('SET user.created_at = timestamp()')
      .return('user')
      .buildQueryObject();
    try {
      const response = await this.neo4jService.write(q.query, { ...q.params });
      const result: User = parseRecord(response.records[0]);
      const { password, ...rest } = result;
      return { ...rest, created_at: formatDate(rest.created_at) };
    } catch (e) {
      if (e.message.includes('already exists')) {
        throw new HttpException(
          'An account with this email or username already exists',
          409,
        );
      } else {
        return e;
      }
    }
  }

  async findOne(props?): Promise<User | undefined> {
    const q = new Query()
      .match([node('user', 'User', props)])
      .return('user')
      .buildQueryObject();
    try {
      const response = await this.neo4jService.read(q.query, q.params);
      if (response.records.length > 0) {
        const result: User = parseRecord(response.records[0]);
        return result;
      } else {
        return undefined;
      }
    } catch (e) {
      return e;
    }
  }
}
