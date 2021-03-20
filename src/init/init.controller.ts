import { Neo4jService } from 'nest-neo4j/dist';

import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';

@Controller('init')
export class InitController {
  constructor(private readonly neo4jService: Neo4jService) {}

  private async createUniqueConstraint(
    nodeLabel: string,
    property: string,
    name?: string,
  ) {
    return this.neo4jService.write(
      `CREATE CONSTRAINT ${
        name ? name : ''
      } IF NOT EXISTS ON (n:${nodeLabel}) ASSERT n.${property} IS UNIQUE`,
    );
  }

  @Post()
  async initDd(@Body() body) {
    try {
      if (body.auth_pass !== 'iepure') {
        throw new UnauthorizedException();
      }
      await this.createUniqueConstraint('User', 'email', 'c_user_email_unique');
      await this.createUniqueConstraint('User', 'id', 'c_user_id_unique');
      await this.createUniqueConstraint('Model', 'id', 'c_model_id_unique');
      return 'OK';
    } catch (e) {
      return e;
    }
  }
}
