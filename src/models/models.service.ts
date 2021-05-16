import { Neo4jService } from 'nest-neo4j/dist';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import slugify from 'slugify';
const bytes = require('bytes');
import { Query, node, relation } from 'cypher-query-builder';

import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { ModelUploadFiles } from './interfaces/files.interface';
import { formatDate, parseRecord } from 'src/utils/neo4j-utils';
import {
  FindOneQueryResponse,
  FindOneRequestResponse,
  Model,
  StrippedModelWithUsername,
} from './interfaces/model.interfaces';
import { User } from 'src/users/interfaces/user.interface';
import { AssetsService } from 'src/assets/assets.service';

@Injectable()
export class ModelsService {
  constructor(
    private readonly neo4jService: Neo4jService,
    private readonly assetsService: AssetsService,
  ) {}

  async create(user: User, createModelDto: CreateModelDto): Promise<any> {
    const errors = [];
    const gltfFile = createModelDto.gltf.find((fileInfo) =>
      fileInfo.name.endsWith('.gltf'),
    );
    if (!gltfFile) {
      errors.push('A GLTF file is required!');
    }
    if (errors.length) {
      return {
        statusCode: 400,
        message: errors,
        error: 'Bad Request',
      };
    }
    const gltfValidationResponse = await this.assetsService.validateGltfPayload(
      createModelDto.gltf,
    );
    if (gltfValidationResponse.errors !== undefined) {
      return {
        statusCode: 400,
        message: gltfValidationResponse.errors,
        error: 'Bad Request',
      };
    }
    const { totalTriangleCount, totalVertexCount } = gltfValidationResponse;
    const id = uuidv4();
    const dirPath = `${process.env.UPLOAD_DIRECTORY}/${user.username}`;
    const slug = `${slugify(createModelDto.name.toLowerCase())}-${id}`;
    const modelPath = `${dirPath}/${slug}`;
    const files = (
      await this.assetsService.moveFiles(
        createModelDto.models,
        `${modelPath}/files`,
      )
    ).map((file) => JSON.stringify(file));
    const images = (
      await this.assetsService.moveFiles(
        createModelDto.images,
        `${modelPath}/images`,
      )
    ).map((file) => file.name);
    const gltf = (
      await this.assetsService.moveFiles(
        createModelDto.gltf,
        `${modelPath}/gltf`,
      )
    ).find((file) => file.name.endsWith('.gltf')).name;
    const { tags, name, description } = createModelDto;
    const modelData = {
      id,
      name,
      description,
      slug,
      files,
      images,
      gltf,
      views: 0,
      downloads: 0,
      totalTriangleCount,
      totalVertexCount,
      metadata: undefined,
    };
    if (createModelDto.metadata) {
      modelData.metadata = JSON.stringify(createModelDto.metadata);
    }
    const modelCreationQ = new Query()
      .create([node('model', 'Model', modelData)])
      .setVariables({ 'model.created_at': 'timestamp()' })
      .buildQueryObject();
    await this.neo4jService.write(modelCreationQ.query, modelCreationQ.params);

    const userModelLinkQ = new Query()
      .matchNode('user', 'User', { id: user.id })
      .matchNode('model', 'Model', { id })
      .create([node('user'), relation('out', '', 'UPLOADED'), node('model')])
      .buildQueryObject();
    await this.neo4jService.write(userModelLinkQ.query, userModelLinkQ.params);

    const tagsQuery = new Query()
      .matchNode('model', 'Model', { id })
      .with('model')
      .unwind(tags, 'tagName')
      .raw('MERGE (tag:Tag {name: tagName})')
      .merge([node('model'), relation('out', '', 'TAGGED_WITH'), node('tag')])
      .buildQueryObject();
    await this.neo4jService.write(tagsQuery.query, tagsQuery.params);

    return { slug };
  }

  async findAllWithUsername(): Promise<StrippedModelWithUsername[]> {
    const q = new Query()
      .match([
        node('m', 'Model'),
        relation('in', '', 'UPLOADED'),
        node('user', 'User'),
      ])
      .return({
        m: [{ slug: 'slug' }, { name: 'name' }, { 'images[0]': 'image' }],
        user: ['username'],
      })
      .build();
    const res = await this.neo4jService.read(q);
    const parsed: StrippedModelWithUsername[] = res.records.map((r) =>
      parseRecord(r),
    );
    return parsed;
  }

  async findBySearchTerm(
    searchTerm: string,
  ): Promise<StrippedModelWithUsername[]> {
    const q = new Query()
      .raw(
        'CALL db.index.fulltext.queryNodes("modelNamesAndDescriptions", $searchTerm) YIELD node',
        { searchTerm },
      )
      .with('node')
      .match([
        node('node'),
        relation('in', '', 'UPLOADED'),
        node('user', 'User'),
      ])
      .return({
        'node.slug': 'slug',
        'node.name': 'name',
        'node.images[0]': 'image',
        user: ['username'],
      })
      .buildQueryObject();
    const response = await this.neo4jService.read(q.query, q.params);
    const result: StrippedModelWithUsername[] = response.records.map((record) =>
      parseRecord(record),
    );
    return result;
  }

  async findOneWithUserAndTags(slug: string): Promise<FindOneRequestResponse> {
    const q = new Query()
      .match([
        node('user', 'User'),
        relation('out', '', 'UPLOADED'),
        node('model', 'Model', { slug }),
        relation('out', '', 'TAGGED_WITH'),
        node('tags', 'Tag'),
      ])
      .return([
        'model',
        {
          user: ['username'],
          'collect(tags.name)': 'tags',
        },
      ])
      .buildQueryObject();
    const response = await this.neo4jService.read(q.query, q.params);
    const { user, tags, ...rest }: FindOneQueryResponse = parseRecord(
      response.records[0],
    );
    const result: FindOneRequestResponse = {
      model: {
        ...rest,
        created_at: formatDate(rest.created_at),
      },
      user,
      tags,
    };
    return result;
  }

  async findOne(slug: string): Promise<Model> {
    const modelQuery = new Query()
      .match([node('model', 'Model', { slug })])
      .return('model')
      .buildQueryObject();
    const mqRes = await this.neo4jService.read(
      modelQuery.query,
      modelQuery.params,
    );
    return parseRecord(mqRes.records[0]);
  }

  async findModelAuthor(slug: string): Promise<User> {
    const modelAuthorQuery = new Query()
      .match([
        node('user', 'User'),
        relation('out', 'UPLOADED'),
        node('model', 'Model', { slug }),
      ])
      .return('user')
      .buildQueryObject();
    const maqRes = await this.neo4jService.read(
      modelAuthorQuery.query,
      modelAuthorQuery.params,
    );
    return parseRecord(maqRes.records[0]);
  }

  async findModelTags(slug: string): Promise<string[]> {
    const q = new Query()
      .match([
        node('model', 'Model', { slug }),
        relation('out', '', 'TAGGED_WITH'),
        node('tags', 'Tag'),
      ])
      .return({
        'collect(tags.name)': 'tags',
      })
      .buildQueryObject();
    const response = await this.neo4jService.read(q.query, q.params);
    const tags = parseRecord(response.records[0]);
    return tags;
  }

  async incrementViews(slug: string): Promise<any> {
    const q = new Query()
      .match([node('model', 'Model', { slug })])
      .setVariables({
        'model.views': 'model.views+1',
      })
      .buildQueryObject();
    await this.neo4jService.write(q.query, q.params);
  }

  async update(slug: string, updateModelDto: UpdateModelDto, userId: string) {
    const author = await this.findModelAuthor(slug);
    if (author.id !== userId) {
      throw new UnauthorizedException();
    }
    const model = await this.findOne(slug);
    const modelPath = `${process.env.UPLOAD_DIRECTORY}/${author.username}/${slug}`;
    if (updateModelDto.images?.length) {
      const images = (
        await this.assetsService.moveFiles(
          updateModelDto.images,
          `${modelPath}/images`,
        )
      ).map((file) => file.name);
      model.images = [...model.images, ...images];
    }
    if (updateModelDto.gltf?.length) {
      const gltfFile = updateModelDto.gltf.find((fileInfo) =>
        fileInfo.name.endsWith('.gltf'),
      );
      if (!gltfFile) {
        throw new BadRequestException('A GLTF file is required');
      }
      const gltfValidationResponse = await this.assetsService.validateGltfPayload(
        updateModelDto.gltf,
      );
      if (gltfValidationResponse.errors !== undefined) {
        throw new BadRequestException(gltfValidationResponse.errors);
      }
      const gltf = (
        await this.assetsService.moveFiles(
          updateModelDto.gltf,
          `${modelPath}/gltf`,
        )
      ).find((file) => file.name.endsWith('.gltf')).name;
      model.gltf = gltf;
    }
    if (updateModelDto.models?.length) {
      const files = (
        await this.assetsService.moveFiles(
          updateModelDto.models,
          `${modelPath}/files`,
        )
      ).map((file) => JSON.stringify(file));
      model.files = [...model.files, ...files];
    }
    const currentModelTags = await this.findModelTags(slug);
    const newTags = updateModelDto.tags.filter(
      (tag) => !currentModelTags.includes(tag),
    );
    const deletedTags = currentModelTags.filter(
      (tag) => !updateModelDto.tags.includes(tag),
    );
    if (newTags.length) {
      const newTagsQuery = new Query()
        .matchNode('model', 'Model', { slug })
        .with('model')
        .unwind(newTags, 'tagName')
        .raw('MERGE (tag:Tag {name: tagName})')
        .merge([node('model'), relation('out', '', 'TAGGED_WITH'), node('tag')])
        .buildQueryObject();
      await this.neo4jService.write(newTagsQuery.query, newTagsQuery.params);
    }
    if (deletedTags.length) {
      const deleteTagsQuery = new Query()
        .matchNode('model', 'Model', { slug })
        .with('model')
        .unwind(deletedTags, 'tagName')
        .raw('MATCH (model)-[rel:TAGGED_WITH]->(tag:Tag {name: tagName})')
        .delete('rel')
        .buildQueryObject();
      await this.neo4jService.write(
        deleteTagsQuery.query,
        deleteTagsQuery.params,
      );
    }
    const updateQuery = new Query()
      .matchNode('model', 'Model', { slug })
      .setValues({
        'model.name': updateModelDto.name,
        'model.description': updateModelDto.description,
        'model.metadata': JSON.stringify(updateModelDto.metadata) ?? null,
        'model.images': model.images,
        'model.files': model.files,
        'model.gltf': model.gltf,
      })
      .buildQueryObject();
    await this.neo4jService.write(updateQuery.query, updateQuery.params);
    return { success: true };
  }

  async remove(id: string): Promise<any> {
    const res = await this.neo4jService.write(
      'MATCH (n:Model {id: $id}) delete n',
      { id },
    );
    return res;
  }

  async setModelImages(slug: string, images: string[]) {
    const updateImagesQuery = new Query()
      .match([node('model', 'Model', { slug })])
      .setValues({ 'model.images': images })
      .buildQueryObject();
    await this.neo4jService.write(
      updateImagesQuery.query,
      updateImagesQuery.params,
    );
  }

  async setModelFiles(slug: string, files: string[]) {
    const updateFilesQuery = new Query()
      .match([node('model', 'Model', { slug })])
      .setValues({ 'model.files': files })
      .buildQueryObject();
    await this.neo4jService.write(
      updateFilesQuery.query,
      updateFilesQuery.params,
    );
  }

  async removeModelGltf(slug: string) {
    const removeGltfQuery = new Query()
      .match([node('model', 'Model', { slug })])
      .setValues({ 'model.gltf': '' })
      .buildQueryObject();
    await this.neo4jService.write(
      removeGltfQuery.query,
      removeGltfQuery.params,
    );
  }

  private async deleteFiles(files: fs.PathLike[]) {
    files.forEach((file) => fs.promises.unlink(file));
  }
}
