import { Neo4jOrmService } from './../neo4j-orm/neo4j-orm.service';
import { Injectable } from '@nestjs/common';

import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagsService {
  constructor(private readonly neo4jOrm: Neo4jOrmService) {}

  create(createTagDto: CreateTagDto) {
    return 'This action adds a new tag';
  }

  async findAll(): Promise<any> {
    return this.neo4jOrm.findAll('Tag');
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
