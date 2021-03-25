import { Neo4jOrmModule } from './../neo4j-orm/neo4j-orm.module';
import { Module } from '@nestjs/common';

import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  imports: [Neo4jOrmModule],
  controllers: [TagsController],
  providers: [TagsService],
})
export class TagsModule {}
