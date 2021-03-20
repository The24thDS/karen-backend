import { Module } from '@nestjs/common';

import { Neo4jOrmModule } from '../neo4j-orm/neo4j-orm.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [Neo4jOrmModule],
  providers: [UsersService],
  exports: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
