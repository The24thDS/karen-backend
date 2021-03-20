import { Test, TestingModule } from '@nestjs/testing';

import { Neo4jOrmService } from './neo4j-orm.service';

describe('Neo4jOrmService', () => {
  let service: Neo4jOrmService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Neo4jOrmService],
    }).compile();

    service = module.get<Neo4jOrmService>(Neo4jOrmService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
