import { Neo4jService } from 'nest-neo4j/dist';
import Model from 'src/types/model';
import { ParseModel, ParseModels } from 'src/utils/parsers/models.parser';
import { v4 as uuidv4 } from 'uuid';

import { Injectable } from '@nestjs/common';

import { Neo4jOrmService } from '../neo4j-orm/neo4j-orm.service';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import SourceNode from 'src/types/source-node';
import WithNode from 'src/types/with-node';

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
    return { id: res.id };
  }

  async findAll(): Promise<any> {
    const res = await this.neo4jOrm.findAll('Model', {}, [
      { propName: 'id', alias: 'id' },
      { propName: 'name', alias: 'name' },
      { propName: 'images[0]', alias: 'image' },
    ]);
    return res;
  }

  async findBySearchTerm(searchTerm: string): Promise<any> {
    const response = await this.neo4jOrm.fullTextQuery(
      'modelNamesAndDescriptions',
      searchTerm,
      [
        { propName: 'id', alias: 'id' },
        { propName: 'name', alias: 'name' },
        { propName: 'images[0]', alias: 'image' },
      ],
    );
    return response;
  }

  async findOneWithUserAndTags(id: string): Promise<any> {
    const sourceNode: SourceNode = { label: 'Model', queryProps: { id } };
    const withNodes: WithNode[] = [
      {
        label: 'User',
        relation: { direction: 'towards-source', label: 'UPLOADED' },
        returnProps: ['id', 'email'],
      },
      {
        label: 'Tag',
        relation: { direction: 'from-source', label: 'TAGGED_WITH' },
        returnProps: [
          {
            propName: 'name',
            alias: 'tags',
            aggregateFunction: 'collect',
          },
        ],
      },
    ];
    const result = await this.neo4jOrm.findOneWith(sourceNode, withNodes);
    const response = {
      model: {
        id: result.id,
        name: result.name,
        description: result.description,
        images: result.images,
        files: result.files,
      },
      user: {
        id: result.u.id,
        email: result.u.email,
      },
      tags: result.tags,
    };
    return response;
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
