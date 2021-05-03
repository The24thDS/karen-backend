import { Neo4jService } from 'nest-neo4j/dist';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import slugify from 'slugify';
const validator = require('gltf-validator');
const bytes = require('bytes');
import { Query, node, relation } from 'cypher-query-builder';

import { Injectable } from '@nestjs/common';

import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { ModelUploadFiles } from './interfaces/files.interface';
import { formatDate, parseRecord } from 'src/utils/neo4j-utils';
import {
  FindOneQueryResponse,
  FindOneRequestResponse,
  StrippedModelWithUsername,
} from './interfaces/model.interfaces';
import { User } from 'src/users/interfaces/user.interface';

@Injectable()
export class ModelsService {
  constructor(private readonly neo4jService: Neo4jService) {}

  async create(
    user: User,
    createModelDto: CreateModelDto,
    uploadedFiles: ModelUploadFiles,
  ): Promise<any> {
    const errors = [];
    const gltfModelFile = uploadedFiles?.gltf?.find((file) =>
      file.originalname.endsWith('.gltf'),
    );
    let totalTriangleCount = 0;
    let totalVertexCount = 0;
    if (!uploadedFiles.images || uploadedFiles.images.length === 0) {
      errors.push('Images are required.');
    }
    if (!uploadedFiles.models || uploadedFiles.models.length === 0) {
      errors.push('Models are required.');
    }
    if (
      !uploadedFiles.gltf ||
      uploadedFiles.gltf.length === 0 ||
      !gltfModelFile
    ) {
      errors.push('At least a GLTF file is required');
    }
    if (errors.length) {
      this.deleteFiles(uploadedFiles.images.map((f) => f.path));
      this.deleteFiles(uploadedFiles.models.map((f) => f.path));
      this.deleteFiles(uploadedFiles.gltf.map((f) => f.path));
      return {
        statusCode: 400,
        message: errors,
        error: 'Bad Request',
      };
    }
    if (gltfModelFile) {
      const arrayBuffer = await fs.promises.readFile(gltfModelFile.path);
      const result = await validator.validateBytes(
        new Uint8Array(arrayBuffer),
        {
          externalResourceFunction: (uri) =>
            new Promise(async (resolve, reject) => {
              const splitURI = uri.split('/');
              const resource = uploadedFiles.gltf.find(
                (file) => file.originalname === splitURI[splitURI.length - 1],
              );
              if (resource) {
                const arrayBuffer = await fs.promises.readFile(resource.path);
                resolve(new Uint8Array(arrayBuffer));
              } else {
                reject(
                  `${uri} is referenced in the GLTF object but it was not selected by the user.`,
                );
              }
            }),
        },
      );
      if (result.issues.numErrors === 0) {
        totalTriangleCount = result.info.totalTriangleCount;
        totalVertexCount = result.info.totalVertexCount;
      } else {
        this.deleteFiles(uploadedFiles.images.map((f) => f.path));
        this.deleteFiles(uploadedFiles.models.map((f) => f.path));
        this.deleteFiles(uploadedFiles.gltf.map((f) => f.path));
        const errors = result.issues.messages.map((msgObj) => msgObj.message);
        if (errors.length) {
          return {
            statusCode: 400,
            message: errors,
            error: 'Bad Request',
          };
        }
      }
    }
    const id = uuidv4();
    const dirPath = `${process.env.UPLOAD_DIRECTORY}/${user.username}`;
    const slug = `${slugify(createModelDto.name.toLowerCase())}-${id}`;
    const modelPath = `${dirPath}/${slug}`;
    // create user's dir if it doesn't exist
    if (!fs.existsSync(dirPath)) {
      try {
        await fs.promises.mkdir(dirPath);
      } catch (error) {
        console.log(error);
        this.deleteFiles(uploadedFiles.images.map((f) => f.path));
        this.deleteFiles(uploadedFiles.models.map((f) => f.path));
        this.deleteFiles(uploadedFiles.gltf.map((f) => f.path));
        throw new Error(error.message);
      }
    }
    // create model's directories
    try {
      await fs.promises.mkdir(modelPath);
      await fs.promises.mkdir(`${modelPath}/files`);
      await fs.promises.mkdir(`${modelPath}/images`);
      await fs.promises.mkdir(`${modelPath}/gltf`);
    } catch (error) {
      console.log(error);
      this.deleteFiles(uploadedFiles.images.map((f) => f.path));
      this.deleteFiles(uploadedFiles.models.map((f) => f.path));
      this.deleteFiles(uploadedFiles.gltf.map((f) => f.path));
      throw new Error(error.message);
    }
    const files = [];
    const images = [];
    let gltf = '';
    // move files
    for (let i = 0; i < uploadedFiles.models.length; i++) {
      const file = uploadedFiles.models[i];
      try {
        await fs.promises.rename(
          file.path,
          `${modelPath}/files/${file.originalname}`,
        );
        files.push(
          JSON.stringify({ name: file.originalname, size: bytes(file.size) }),
        );
      } catch (error) {
        fs.promises.rmdir(modelPath);
        console.log(error);
        throw new Error(error.message);
      }
    }
    // move images
    for (let i = 0; i < uploadedFiles.images.length; i++) {
      const file = uploadedFiles.images[i];
      try {
        await fs.promises.rename(
          file.path,
          `${modelPath}/images/${file.originalname}`,
        );
        images.push(file.originalname);
      } catch (error) {
        fs.promises.rmdir(modelPath);
        console.log(error);
        throw new Error(error.message);
      }
    }
    // move gltf
    for (let i = 0; i < uploadedFiles.gltf.length; i++) {
      const file = uploadedFiles.gltf[i];
      try {
        await fs.promises.rename(
          file.path,
          `${modelPath}/gltf/${file.originalname}`,
        );
        if (file.originalname.endsWith('.gltf')) {
          gltf = file.originalname;
        }
      } catch (error) {
        fs.promises.rmdir(modelPath);
        console.log(error);
        throw new Error(error.message);
      }
    }
    const { tags, ...modelProps } = createModelDto;
    const modelCreationQ = new Query()
      .create([
        node('model', 'Model', {
          ...modelProps,
          id,
          slug,
          files,
          images,
          gltf,
          views: 0,
          downloads: 0,
          totalTriangleCount,
          totalVertexCount,
        }),
      ])
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

  async incrementViews(slug: string): Promise<any> {
    const q = new Query()
      .match([node('model', 'Model', { slug })])
      .setVariables({
        'model.views': 'model.views+1',
      })
      .buildQueryObject();
    await this.neo4jService.write(q.query, q.params);
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

  private async deleteFiles(files: fs.PathLike[]) {
    files.forEach((file) => fs.promises.unlink(file));
  }
}
