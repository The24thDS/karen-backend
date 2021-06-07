import { Neo4jService } from 'nest-neo4j/dist';
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';
import { Query, node, relation, not } from 'cypher-query-builder';

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { formatDate, parseRecord } from 'src/utils/neo4j-utils';
import {
  FindOneQueryResponse,
  FindOneRequestResponse,
  Model,
  ModelFile,
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
      throw new BadRequestException(errors);
    }
    const gltfValidationResponse = await this.assetsService.validateGltfPayload(
      createModelDto.gltf,
    );
    if (gltfValidationResponse.errors !== undefined) {
      throw new BadRequestException(gltfValidationResponse.errors);
    }
    const { totalTriangleCount, totalVertexCount } = gltfValidationResponse;
    const id = uuidv4();
    const dirPath = `${process.env.UPLOAD_DIRECTORY}/${user.username}`;
    const slug = `${slugify(createModelDto.name.toLowerCase())}-${id}`;
    const modelPath = `${dirPath}/${slug}`;
    const files = await this.assetsService.moveFiles(
      createModelDto.models,
      `${modelPath}/files`,
    );
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
    const q = new Query()
      .createNode('model', 'Model', modelData)
      .setVariables({ 'model.created_at': 'timestamp()' })
      .with('model')
      .matchNode('user', 'User', { id: user.id })
      .create([node('user'), relation('out', 'r', 'UPLOADED'), node('model')])
      .with('model')
      .raw(
        'FOREACH (tagName in $tags | MERGE (tag:Tag {name: tagName}) CREATE (model)-[:TAGGED_WITH]->(tag))',
        { tags },
      )
      .raw(
        'FOREACH (file in $files | CREATE (model)-[:HAS_FILE]->(:File {name: file.name, size: file.size, type: file.type}))',
        { files },
      )
      .buildQueryObject();
    await this.neo4jService.write(q.query, q.params);

    return { slug };
  }

  async findAllWithUsername(urlQuery): Promise<StrippedModelWithUsername[]> {
    const page = Number(urlQuery.page ?? 0);
    const pageSize = Number(urlQuery.pageSize ?? 25);
    const { query, params } = new Query()
      .match([
        node('m', 'Model'),
        relation('in', '', 'UPLOADED'),
        node('user', 'User'),
      ])
      .return({
        m: [
          { slug: 'slug' },
          { name: 'name' },
          { 'images[0]': 'image' },
          { created_at: 'created_at' },
        ],
        user: ['username'],
      })
      .orderBy('created_at', 'DESC')
      .skip(page * pageSize)
      .limit(pageSize)
      .buildQueryObject();
    const res = await this.neo4jService.read(query, params);
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

  async findOneWithUser(
    slug: string,
    userId: string = null,
  ): Promise<FindOneRequestResponse> {
    let q = new Query()
      .match([
        node('user', 'User'),
        relation('out', '', 'UPLOADED'),
        node('model', 'Model', { slug }),
        relation('out', 'r', ['HAS_FILE', 'TAGGED_WITH']),
        node('x'),
      ])
      .return([
        'model',
        {
          user: ['username'],
          'type(r)': 'relType',
        },
      ])
      .raw(
        `,
        case type(r)
          when 'HAS_FILE' then collect(properties(x))
          when 'TAGGED_WITH' then collect(x.name)
        end as nodes
      `,
      )
      .orderBy('relType')
      .buildQueryObject();
    let dbResponse = await this.neo4jService.read(q.query, q.params);
    const [
      { nodes: files, user, relType, ...rest },
      { nodes: tags },
    ]: FindOneQueryResponse[] = dbResponse.records.map((r) => parseRecord(r));
    const rating = await this.getRating(slug);
    const isUpvoted = userId ? await this.isUpvotedByUser(slug, userId) : false;
    const isDownvoted = userId
      ? await this.isDownvotedByUser(slug, userId)
      : false;
    const result: FindOneRequestResponse = {
      model: {
        ...rest,
        files: files as ModelFile[],
        rating,
        isUpvoted,
        isDownvoted,
        created_at: formatDate(rest.created_at),
      },
      user,
      tags: tags as string[],
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
  // TODO: refactor with the new query
  async upvote(slug: string, userId: string): Promise<any> {
    if (await this.exists(slug)) {
      const existsQuery =
        'RETURN EXISTS ((:User { id: $id })-[:UPVOTED]->(:Model { slug: $slug })) as upvoteExists;';
      let dbResponse = await this.neo4jService.read(existsQuery, {
        id: userId,
        slug,
      });
      const { upvoteExists } = parseRecord(dbResponse.records[0]);
      if (upvoteExists) {
        const removeQ = new Query()
          .match([
            node('', 'User', { id: userId }),
            relation('out', 'r', 'UPVOTED'),
            node('', 'Model', { slug }),
          ])
          .delete('r')
          .buildQueryObject();
        await this.neo4jService.write(removeQ.query, removeQ.params);
      } else {
        const createQ = new Query()
          .matchNode('u', 'User', { id: userId })
          .matchNode('m', 'Model', { slug })
          .create([node('u'), relation('out', 'r', 'UPVOTED'), node('m')])
          .buildQueryObject();
        await this.neo4jService.write(createQ.query, createQ.params);
      }
      return { success: true };
    } else {
      throw new NotFoundException('Model NOT FOUND');
    }
  }
  // TODO: refactor with the new query
  async downvote(slug: string, userId: string): Promise<any> {
    if (await this.exists(slug)) {
      const existsQuery =
        'RETURN EXISTS ((:User { id: $id })-[:DOWNVOTED]->(:Model { slug: $slug })) as downvoteExists;';
      let dbResponse = await this.neo4jService.read(existsQuery, {
        id: userId,
        slug,
      });
      const { downvoteExists } = parseRecord(dbResponse.records[0]);
      if (downvoteExists) {
        const removeQ = new Query()
          .match([
            node('', 'User', { id: userId }),
            relation('out', 'r', 'DOWNVOTED'),
            node('m', 'Model', { slug }),
          ])
          .delete('r')
          .buildQueryObject();
        await this.neo4jService.write(removeQ.query, removeQ.params);
      } else {
        const createQ = new Query()
          .matchNode('u', 'User', { id: userId })
          .matchNode('m', 'Model', { slug })
          .create([node('u'), relation('out', 'r', 'DOWNVOTED'), node('m')])
          .buildQueryObject();
        await this.neo4jService.write(createQ.query, createQ.params);
      }
      return { success: true };
    } else {
      throw new NotFoundException('Model NOT FOUND');
    }
  }

  async addToCollection(
    modelSlug: string,
    collectionSlug: string,
  ): Promise<any> {
    const { query, params } = new Query()
      .matchNode('model', 'Model', { slug: modelSlug })
      .matchNode('c', 'Collection', { slug: collectionSlug })
      .create([
        node('model'),
        relation('out', '', 'IS_IN_COLLECTION'),
        node('c'),
      ])
      .buildQueryObject();
    try {
      await this.neo4jService.write(query, params);
      return { success: true };
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(e.message);
    }
  }

  async removeFromCollection(
    modelSlug: string,
    collectionSlug: string,
  ): Promise<any> {
    const { query, params } = new Query()
      .match([
        node('model', 'Model', { slug: modelSlug }),
        relation('out', 'r', 'IS_IN_COLLECTION'),
        node('c', 'Collection', { slug: collectionSlug }),
      ])
      .delete('r')
      .buildQueryObject();
    try {
      await this.neo4jService.write(query, params);
      return { success: true };
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(e.message);
    }
  }

  async findRecommendedModels(slug: string) {
    const { query, params } = new Query()
      .matchNode('m', 'Model', { slug })
      .with(['m', 'split(toLower(m.name), " ") as words'])
      .match([
        node('m'),
        relation('out', '', 'TAGGED_WITH'),
        node('tag', 'Tag'),
        relation('in', '', 'TAGGED_WITH'),
        node('', 'Model'),
      ])
      .with([
        'tag',
        `
          case
            when tag.name IN words then 1.0/count(*)*(150/count(*))
            else 1.0/count(*)
          end as score
        `,
      ])
      .match([
        [
          node('otherM', 'Model'),
          relation('out', '', 'TAGGED_WITH'),
          node('tag'),
        ],
        [
          node('otherM', 'Model'),
          relation('in', '', 'UPLOADED'),
          node('user', 'User'),
        ],
      ])
      .where(not({ otherM: { slug } }))
      .return([
        {
          otherM: [
            { name: 'name' },
            { slug: 'slug' },
            { 'images[0]': 'image' },
          ],
          user: ['username'],
        },
        'sum(score) as score',
      ])
      .orderBy('score', 'DESC')
      .limit(10)
      .buildQueryObject();
    try {
      const response = await this.neo4jService.read(query, params);
      const results: StrippedModelWithUsername[] = response.records
        .map((r) => parseRecord(r))
        .map((r) => ({
          name: r.name,
          slug: r.slug,
          image: r.image,
          user: r.user,
        }));
      return results;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Failed getting recommendations');
    }
  }

  async update(slug: string, updateModelDto: UpdateModelDto, userId: string) {
    const author = await this.findModelAuthor(slug);
    if (author.id !== userId) {
      throw new UnauthorizedException();
    }
    const model = await this.findOne(slug);
    const modelPath = `${process.env.UPLOAD_DIRECTORY}/${author.username}/${slug}`;
    let newFiles = [];
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
      newFiles = await this.assetsService.moveFiles(
        updateModelDto.models,
        `${modelPath}/files`,
      );
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
        'model.gltf': model.gltf,
      })
      .with('model')
      .unwind(newFiles, 'file')
      .raw(
        'CREATE (model)-[:HAS_FILE]->(:File {name: file.name, size: file.size, type: file.type})',
      )
      .buildQueryObject();
    await this.neo4jService.write(updateQuery.query, updateQuery.params);
    return { success: true };
  }

  async remove(slug: string): Promise<any> {
    const { query, params } = new Query()
      .match([
        node('model', 'Model', { slug }),
        relation('in', '', 'UPLOADED'),
        node('user', 'User'),
      ])
      .match([
        node('model'),
        relation('out', '', 'HAS_FILE'),
        node('file', 'File'),
      ])
      .detachDelete(['model', 'file'])
      .return('user.username')
      .buildQueryObject();
    const response = await this.neo4jService.write(query, params);
    const { username } = parseRecord(response.records[0]);
    await this.assetsService.removeModelAssets(username, slug);
    return { success: true };
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

  async removeFile(slug: string, name: string) {
    const updateFilesQuery = new Query()
      .match([
        node('model', 'Model', { slug }),
        relation('out', '', 'HAS_FILE'),
        node('file', 'File', { name }),
      ])
      .detachDelete('file')
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

  async exists(slug: string): Promise<boolean> {
    const q = new Query()
      .matchNode('m', 'Model', { slug })
      .return({ 'count(*)': 'count' })
      .buildQueryObject();
    const dbResponse = await this.neo4jService.read(q.query, q.params);
    console.log(dbResponse.records[0]);
    const count = parseRecord(dbResponse.records[0]);
    return !!count;
  }

  async getRating(slug: string): Promise<number> {
    const q = new Query()
      .match([
        node('', 'User'),
        relation('out', 'r', ['DOWNVOTED', 'UPVOTED']),
        node('model', 'Model', { slug }),
      ])
      .return({
        'type(r)': 'type',
        'count(*)': 'amount',
      })
      .buildQueryObject();
    const dbResponse = await this.neo4jService.read(q.query, q.params);
    const dbVotes = Object.fromEntries(
      dbResponse.records.map((r) => {
        const parsed = parseRecord(r);
        return [parsed.type, parsed.amount];
      }),
    );
    const votes = {
      UPVOTED: 0,
      DOWNVOTED: 0,
      ...dbVotes,
    };
    return votes.UPVOTED - votes.DOWNVOTED;
  }

  async isUpvotedByUser(slug: string, userId: string): Promise<boolean> {
    const q =
      'RETURN EXISTS ((:User { id: $id })-[:UPVOTED]->(:Model { slug: $slug })) as upvoted';
    const dbResponse = await this.neo4jService.read(q, {
      id: userId,
      slug,
    });
    const { upvoted } = parseRecord(dbResponse.records[0]);
    return upvoted;
  }

  async isDownvotedByUser(slug: string, userId: string): Promise<boolean> {
    const q =
      'RETURN EXISTS ((:User { id: $id })-[:DOWNVOTED]->(:Model { slug: $slug })) as downvoted';
    const dbResponse = await this.neo4jService.read(q, {
      id: userId,
      slug,
    });
    const { downvoted } = parseRecord(dbResponse.records[0]);
    return downvoted;
  }
}
