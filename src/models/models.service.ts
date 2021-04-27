import { Neo4jService } from 'nest-neo4j/dist';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import slugify from 'slugify';
const validator = require('gltf-validator');
import { format } from 'date-fns';
const bytes = require('bytes');

import { Injectable } from '@nestjs/common';

import { Neo4jOrmService } from '../neo4j-orm/neo4j-orm.service';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import User from 'src/types/user';
import SourceNode from 'src/types/source-node';
import WithNode from 'src/types/with-node';
import ModelUploadFiles from 'src/types/model-upload-files';
import { PathLike } from 'node:fs';

@Injectable()
export class ModelsService {
  constructor(
    private readonly neo4jService: Neo4jService,
    private readonly neo4jOrm: Neo4jOrmService,
  ) {}

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
    await this.neo4jOrm.createOne('Model', {
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
    });
    await this.neo4jOrm.connectNodeToOtherNodes(
      'User',
      { id: user.id },
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
    return { slug };
  }

  async findAll(): Promise<any> {
    const res = await this.neo4jOrm.findAll('Model', {}, [
      { propName: 'id', alias: 'id' },
      { propName: 'name', alias: 'name' },
      { propName: 'images[0]', alias: 'image' },
    ]);
    return res;
  }

  async findAllWithUsername(): Promise<any> {
    const sourceNode: SourceNode = {
      label: 'Model',
      queryProps: {},
      returnProps: [
        { propName: 'slug', alias: 'slug' },
        { propName: 'name', alias: 'name' },
        { propName: 'images[0]', alias: 'image' },
      ],
    };
    const withNodes: WithNode[] = [
      {
        label: 'User',
        relation: { direction: 'towards-source', label: 'UPLOADED' },
        returnProps: ['username'],
      },
    ];
    return await this.neo4jOrm.findWith(sourceNode, withNodes);
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

  async findOneWithUserAndTags(slug: string): Promise<any> {
    const sourceNode: SourceNode = { label: 'Model', queryProps: { slug } };
    const withNodes: WithNode[] = [
      {
        label: 'User',
        relation: { direction: 'towards-source', label: 'UPLOADED' },
        returnProps: ['username'],
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
    const { tags, u, views, created_at, ...rest } = (
      await this.neo4jOrm.findWith(sourceNode, withNodes)
    )[0];
    const response = {
      model: {
        ...rest,
        views: Number(views.toString()),
        created_at: format(
          Number(created_at.toString()),
          'dd-MM-yyyy HH:mm:ss xxx',
        ),
      },
      user: {
        username: u.username,
      },
      tags,
    };
    return response;
  }

  async incrementViews(slug: string): Promise<any> {
    return this.neo4jOrm.setProperty(
      'Model',
      { slug },
      'views',
      { value: 'n.views+1', isExpression: true },
      { value: 0, isExpression: false },
    );
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

  private async deleteFiles(files: PathLike[]) {
    files.forEach((file) => fs.promises.unlink(file));
  }
}
