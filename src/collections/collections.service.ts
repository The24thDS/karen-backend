import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { Neo4jService } from 'nest-neo4j/dist';
import { v4 as uuidv4 } from 'uuid';

import { RequestUser } from 'src/users/interfaces/user.interface';
import { formatDate, parseRecord } from 'src/utils/neo4j-utils';
import { StoreCollectionDTO } from './dto/store-collection.dto';
import slugify from 'slugify';
import { UpdateCollectionDTO } from './dto/update-collection.dto';
import {
  Collection,
  CollectionWithUserAndModels,
  CollectionWithUser,
} from './interfaces/collections.interfaces';

@Injectable()
export class CollectionsService {
  constructor(private readonly neo4jSevice: Neo4jService) {}

  async store(
    user: RequestUser,
    data: StoreCollectionDTO,
  ): Promise<{ success: boolean; collection: Collection }> {
    if (!['public', 'private'].includes(data.visibility)) {
      throw new BadRequestException(
        'Visibility value must be "public" or "private"',
      );
    }
    const id = uuidv4();
    const { query, params } = new Query()
      .matchNode('user', 'User', { id: user.id })
      .create([
        node('user'),
        relation('out', '', 'CREATED_COLLECTION'),
        node('c', 'Collection', {
          id,
          slug: slugify(data.name + '_' + id),
          name: data.name,
          description: data.description,
          private: data.visibility === 'private',
        }),
      ])
      .setVariables({
        'c.created': 'timestamp()',
        'c.updated': 'timestamp()',
      })
      .return('c')
      .buildQueryObject();
    try {
      const response = await this.neo4jSevice.write(query, params);
      const result = parseRecord(response.records[0]);
      return {
        success: true,
        collection: {
          ...result,
          created: formatDate(result.created),
          updated: formatDate(result.updated),
        },
      };
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(e.message);
    }
  }

  async update(
    slug: string,
    data: UpdateCollectionDTO,
  ): Promise<{ success: boolean; collection: Collection }> {
    if (!['public', 'private'].includes(data.visibility)) {
      throw new BadRequestException(
        'Visibility value must be "public" or "private"',
      );
    }
    const { query, params } = new Query()
      .matchNode('c', 'Collection', { slug })
      .setValues({
        'c.name': data.name,
        'c.description': data.description,
        'c.private': data.visibility === 'private',
      })
      .setVariables({
        'c.updated': 'timestamp()',
      })
      .return('c')
      .buildQueryObject();
    try {
      const response = await this.neo4jSevice.write(query, params);
      const result = parseRecord(response.records[0]);
      return {
        success: true,
        collection: {
          ...result,
          created: formatDate(result.created),
          updated: formatDate(result.updated),
        },
      };
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(e.message);
    }
  }

  async remove(slug: string): Promise<{ success: boolean }> {
    const { query, params } = new Query()
      .matchNode('c', 'Collection', { slug })
      .detachDelete('c')
      .buildQueryObject();
    try {
      await this.neo4jSevice.write(query, params);
      return { success: true };
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(e.message);
    }
  }

  async findAll(): Promise<Collection[]> {
    const { query, params } = new Query()
      .matchNode('c', 'Collection', { private: false })
      .return('c')
      .buildQueryObject();
    try {
      const response = await this.neo4jSevice.write(query, params);
      const results = response.records
        .map((r) => parseRecord(r))
        .map((r) => ({
          ...r,
          created: formatDate(r.created),
          updated: formatDate(r.updated),
        }));
      return results;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(e.message);
    }
  }

  async findAllForUser(
    reqUser: RequestUser,
    username: string,
  ): Promise<Collection[]> {
    const pattern = [
      node('u', 'User', { username }),
      relation('out', '', 'CREATED_COLLECTION'),
    ];
    if (reqUser.username !== username) {
      pattern.push(node('c', 'Collection', { private: false }));
    } else {
      pattern.push(node('c', 'Collection'));
    }
    const { query, params } = new Query()
      .match(pattern)
      .return('c')
      .buildQueryObject();
    try {
      const response = await this.neo4jSevice.write(query, params);
      const results = response.records
        .map((r) => parseRecord(r))
        .map((r) => ({
          ...r,
          created: formatDate(r.created),
          updated: formatDate(r.updated),
        }));
      return results;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(e.message);
    }
  }

  async findOne(reqUser: RequestUser, slug: string): Promise<Collection> {
    const { user, ...collection } = await this.findOneWithAuthor(slug);
    if (collection.private && reqUser?.id !== user.id) {
      throw new UnauthorizedException('This collection is private.');
    } else {
      return collection;
    }
  }

  async findOneWithAuthorAndModels(
    reqUser: RequestUser,
    slug: string,
  ): Promise<CollectionWithUserAndModels> {
    const { user, ...collection } = await this.findOneWithAuthor(slug);
    if (collection.private && reqUser.id !== user.id) {
      throw new UnauthorizedException('This collection is private.');
    } else {
      const { query, params } = new Query()
        .match([
          node('c', 'Collection', { slug }),
          relation('in', '', 'IS_IN_COLLECTION'),
          node('m', 'Model'),
          relation('in', '', 'UPLOADED'),
          node('u', 'User'),
        ])
        .return({ m: ['name', 'slug', 'images[0]'], u: ['username'] })
        .buildQueryObject();
      try {
        const response = await this.neo4jSevice.write(query, params);
        const result = response.records.map((r) => parseRecord(r));
        return {
          ...collection,
          user,
          models: result.map(({ m, u }) => ({
            name: m.name,
            slug: m.slug,
            image: m['images[0]'],
            user: u,
          })),
        };
      } catch (e) {
        console.log(e);
        throw new InternalServerErrorException(e.message);
      }
    }
  }

  private async findOneWithAuthor(slug: string): Promise<CollectionWithUser> {
    const { query, params } = new Query()
      .match([
        node('c', 'Collection', { slug }),
        relation('in', '', 'CREATED_COLLECTION'),
        node('user', 'User'),
      ])
      .return(['c', { user: ['id', 'username'] }])
      .buildQueryObject();
    try {
      const response = await this.neo4jSevice.write(query, params);
      const result = parseRecord(response.records[0]);
      return {
        ...result,
        created: formatDate(result.created),
        updated: formatDate(result.updated),
      };
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(e.message);
    }
  }
}
