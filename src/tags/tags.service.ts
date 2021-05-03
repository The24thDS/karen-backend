import { Neo4jService } from 'nest-neo4j/dist';
import { Injectable } from '@nestjs/common';

import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { node, Query } from 'cypher-query-builder';
import { parseRecord } from 'src/utils/neo4j-utils';

@Injectable()
export class TagsService {
  constructor(private readonly neo4jService: Neo4jService) {}

  create(createTagDto: CreateTagDto) {
    return 'This action adds a new tag';
  }

  async findAll(): Promise<string[]> {
    const q = new Query().match([node('tag', 'Tag')]).return('tag');
    const response = await this.neo4jService.read(q.build());
    console.log(response.records[0]);
    const tags: string[] = response.records.map((record) =>
      parseRecord(record),
    );
    return tags;
  }

  findOne(id: string) {
    return `This action returns a #${id} tag`;
  }

  update(id: string, updateTagDto: UpdateTagDto) {
    return `This action updates a #${id} tag`;
  }

  remove(id: string) {
    return `This action removes a #${id} tag`;
  }
}
