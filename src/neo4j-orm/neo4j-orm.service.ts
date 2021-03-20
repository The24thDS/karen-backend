import { Neo4jService } from 'nest-neo4j/dist';

import { Injectable } from '@nestjs/common';

@Injectable()
export class Neo4jOrmService {
  private readonly excludedProperties = [];

  constructor(private readonly neo4jService: Neo4jService) {}

  /**
   * Creates a single node with the provided data and returns its properties
   * @param label A capitalized string representing the label of the node
   * @param props An object of properties that will be assigned to the created node
   * @returns A promise that resolves to the node properties
   */
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

  /**
   * Connects an existing node N to other nodes M. If it can't find a node M with the given props it will create one.
   * @param nLabel A capitalized string representing the label of the main node
   * @param nProps An object of properties that will be used to match the main node
   * @param mLabel A capitalized string representing the label of the other nodes
   * @param mProps An array of property objects that will be used to match the other nodes
   * @param rLabel A capitalized string representing the label of the relation
   * @param direction A string representing the directon of the relations established between the main node and the other nodes
   */
  async connectNodeToOtherNodes(
    nLabel: string,
    nProps: any,
    mLabel: string,
    mProps: Array<Object>,
    rLabel: string,
    direction: '>' | '<',
  ) {
    const matchQ = `MATCH (n:${nLabel} {${this.mapPropsWithValues(nProps).join(
      ', ',
    )}})`;
    const relation = `${direction === '<' ? '<' : ''}-[:${rLabel}]-${
      direction === '>' ? '>' : ''
    }`;
    const msMerges = mProps.map(
      (props, idx) =>
        `MERGE (m${idx}:${mLabel} {${this.mapPropsWithValues(props).join(
          ', ',
        )}})`,
    );
    const relationsMerges = mProps.map(
      (_props, idx) => `MERGE (n)${relation}(m${idx})`,
    );
    const query = `${matchQ} ${msMerges.join(' ')} ${relationsMerges.join(
      ' ',
    )}`;
    try {
      await this.neo4jService.write(query);
      return true;
    } catch (e) {
      throw new Error(e);
    }
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

  private mapPropsWithValues(queryProps: any): string[] {
    return Object.entries(queryProps).map(([k, v]) => `${k}: "${v}"`);
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
