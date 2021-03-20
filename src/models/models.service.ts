import { Neo4jService } from 'nest-neo4j/dist';
import Model from 'src/types/model';
import { ParseModel, ParseModels } from 'src/utils/parsers/models.parser';
import { v4 as uuidv4 } from 'uuid';

import { Injectable } from '@nestjs/common';

import { Neo4jOrmService } from '../neo4j-orm/neo4j-orm.service';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';

@Injectable()
export class ModelsService {
  constructor(
    private readonly neo4jService: Neo4jService,
    private readonly neo4jOrm: Neo4jOrmService,
  ) {}

  async create(
    userId: string,
    createModelDto: CreateModelDto,
    modelFiles: string[],
    modelImages: string[],
  ): Promise<any> {
    const id = uuidv4();
    const { tags, ...modelProps } = createModelDto;
    const res = await this.neo4jOrm.createOne('Model', {
      ...modelProps,
      id,
      files: modelFiles,
      images: modelImages,
    });
    await this.neo4jOrm.connectNodeToOtherNodes(
      'User',
      { id: userId },
      'Model',
      [{ id }],
      'UPLOADED',
      '>',
    );
    const tagsProps = tags.map((t) => ({ name: t }));
    await this.neo4jOrm.connectNodeToOtherNodes(
      'Model',
      { id },
      'Tag',
      tagsProps,
      'TAGGED_WITH',
      '>',
    );
    return res;
  }

  async findAll(): Promise<any> {
    const res = await this.neo4jService.read(
      'MATCH (model:Model) return model',
    );
    return { count: res.records.length, records: ParseModels(res.records) };
  }

  async findOne(id: string, returnTags: boolean): Promise<any> {
    const res = await this.neo4jService.read(
      `MATCH (model:Model {id: $id})${
        returnTags ? '-->(tag:Tag)' : ''
      } return model${returnTags ? ', tag' : ''}`,
      { id },
    );
    const parsedModel: Model = ParseModel(res.records);
    return parsedModel;
  }

  update(id: string, updateModelDto: UpdateModelDto) {
    return `This action updates a #${id} model`;
  }

  async remove(id: string): Promise<any> {
    const res = await this.neo4jService.write(
      'MATCH (n:Model {id: $id}) delete n',
      { id },
    );
    return res;
  }
}
