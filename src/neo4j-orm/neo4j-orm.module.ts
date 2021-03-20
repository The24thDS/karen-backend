import { Module } from '@nestjs/common';

import { Neo4jOrmService } from './neo4j-orm.service';

@Module({
  providers: [Neo4jOrmService],
  exports: [Neo4jOrmService],
})
export class Neo4jOrmModule {}
