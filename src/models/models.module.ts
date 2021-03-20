import { Module } from '@nestjs/common';

import { Neo4jOrmModule } from '../neo4j-orm/neo4j-orm.module';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';

@Module({
  imports: [Neo4jOrmModule],
  controllers: [ModelsController],
  providers: [ModelsService],
})
export class ModelsModule {}
