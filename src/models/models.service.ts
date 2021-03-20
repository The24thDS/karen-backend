import { Neo4jService } from 'nest-neo4j/dist';
import Model from 'src/types/model';
import { ParseModel, ParseModels } from 'src/utils/parsers/models.parser';
import { v4 as uuidv4 } from 'uuid';

import { Injectable } from '@nestjs/common';

import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';

@Injectable()
export class ModelsService {
  constructor(private readonly neo4jService: Neo4jService) {}
  async create(
    createModelDto: CreateModelDto,
    modelFiles: string[],
    modelImages: string[],
  ): Promise<any> {
    const id = uuidv4();
    const query =
      'CREATE (m:Model {id: $id, name: $name, files: $files, images: $images}) return m';
    const res = await this.neo4jService.write(query, {
      ...createModelDto,
      id,
      files: modelFiles,
      images: modelImages,
    });
    await this.addTags(createModelDto.tags, id);
    return res.records;
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

  private async addTags(tags: string[], id: string): Promise<any> {
    const tagsMerge = tags.map(
      (tagName, idx) => `MERGE (t${idx}:Tag {name: "${tagName}"})`,
    );
    const relationsMerge = tags.map(
      (_tag, idx) => `MERGE (m)-[:TAGGED_WITH]->(t${idx})`,
    );
    const query = `MATCH (m:Model {id: $id}) ${tagsMerge.join(
      ' ',
    )} ${relationsMerge.join(' ')}`;
    const res = await this.neo4jService.write(query, { id });
    return res;
  }
}