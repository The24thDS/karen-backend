import { Neo4jService } from 'nest-neo4j/dist';

import { Injectable } from '@nestjs/common';

@Injectable()
export class Neo4jOrmService {
  private readonly excludedProperties = [];

  constructor(private readonly neo4jService: Neo4jService) {}

  async createOne(label: string, props: {}): Promise<any> {
    const labelProperties = this.mapProps(props);
    const query = `CREATE (n:${label} {${labelProperties.join(
      ', ',
    )}}) return n`;
    return await this.executeOneEntityQuery(query, props);
  }

  async findOne(
    label: string,
    queryProps: {},
    returnProps?: string[],
  ): Promise<any> {
    const labelProperties = this.mapProps(queryProps);
    let query = `MATCH (n:${label} {${labelProperties.join(', ')}}) return `;
    if (returnProps?.length) {
      const returnProperties = returnProps.map((p) => `n.${p}`).join(', ');
      query += returnProperties;
    } else {
      query += 'n';
    }
    return await this.executeOneEntityQuery(query, queryProps);
  }

  private parseOneResponse(res: any) {
    const { records } = res;
    const entityProperties = records[0].get('n').properties;
    this.excludedProperties.forEach((p) => delete entityProperties[p]);
    return entityProperties;
  }

  private mapProps(queryProps: any): string[] {
    return Object.keys(queryProps).map((p) => `${p}: $${p}`);
  }

  private async executeOneEntityQuery(query: string, props: any) {
    try {
      const res = await this.neo4jService.write(query, props);
      return this.parseOneResponse(res);
    } catch (e) {
      throw new Error(e);
    }
  }
}
