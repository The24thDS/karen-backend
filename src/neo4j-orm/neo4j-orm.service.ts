import { Neo4jService } from 'nest-neo4j/dist';

import { Injectable } from '@nestjs/common';
import SourceNode from 'src/types/source-node';
import WithNode from 'src/types/with-node';

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
    let query = `MATCH (n:${label} {${labelProperties.join(', ')}}) RETURN `;
    if (returnProps?.length) {
      const returnProperties = returnProps.map((p) => `n.${p}`).join(', ');
      query += returnProperties;
    } else {
      query += 'n';
    }
    query += ' LIMIT 1';
    return await this.executeOneEntityQuery(query, queryProps);
  }

  async findOneWith(
    sourceNode: SourceNode,
    withNodes: WithNode[],
  ): Promise<any> {
    console.log(sourceNode, withNodes);
    const keys = [];
    keys.push(sourceNode.label.slice(0, 1).toLowerCase());
    const withNodesQueryObjects = withNodes.map((node) => {
      let i = 1;
      let key = node.label.slice(0, i).toLowerCase();
      while (keys.includes(key)) {
        key = node.label.slice(0, ++i).toLowerCase();
      }
      keys.push(key);
      const { direction, label: relationLabel } = node.relation;
      let relation = `-[:${relationLabel}]-`;
      if (direction === 'from-source') {
        relation += '>';
      } else if (direction === 'towards-source') {
        relation = '<' + relation;
      }
      const queryProps = node.queryProps
        ? this.mapPropsWithValues(node.queryProps)
        : [];
      const returnProps =
        node.returnProps?.map((p) => `${key}.${p}`).join(', ') ?? key;
      return {
        query: `(${keys[0]})${relation}(${key}:${node.label} {${queryProps.join(
          ', ',
        )}})`,
        returnProps,
      };
    });
    const sourceNodeQueryProps = this.mapPropsWithValues(sourceNode.queryProps);
    const sourceNodeQuery = `(${keys[0]}:${
      sourceNode.label
    } {${sourceNodeQueryProps.join(', ')}})`;
    const sourceNodeReturnProps =
      sourceNode.returnProps?.map((p) => `${keys[0]}.${p}`).join(', ') ??
      keys[0];
    const query = `MATCH ${sourceNodeQuery}, ${withNodesQueryObjects
      .map((q) => q.query)
      .join(', ')} RETURN ${sourceNodeReturnProps}, ${withNodesQueryObjects
      .map((q) => q.returnProps)
      .join(', ')}`;
    return await this.executeMultipleEntitiesQuery(query, {});
  }

  async findAll(
    label: string,
    queryProps: {} = {},
    returnProps?: string[],
  ): Promise<any> {
    const labelProperties = this.mapProps(queryProps);
    let query = `MATCH (n:${label} {${labelProperties.join(', ')}}) RETURN `;
    if (returnProps?.length) {
      const returnProperties = returnProps.map((p) => `n.${p}`).join(', ');
      query += returnProperties;
    } else {
      query += 'n';
    }
    return await this.executeMultipleEntitiesQuery(query, queryProps);
  }

  async containsQuery(
    label: string,
    prop: string,
    valueToContain: string,
    queryProps: any = {},
    returnProps?: string[],
  ) {
    const labelProperties = this.mapProps(queryProps);
    const whereClause = `where n.${prop} contains '${valueToContain}'`;
    let query = `MATCH (n:${label} {${labelProperties.join(
      ', ',
    )}}) ${whereClause} RETURN `;
    if (returnProps?.length) {
      const returnProperties = returnProps.map((p) => `n.${p}`).join(', ');
      query += returnProperties;
    } else {
      query += 'n';
    }
    return await this.executeMultipleEntitiesQuery(query, queryProps);
  }

  async fullTextQuery(
    indexName: string,
    queryValue: string,
    returnProps?: string[],
  ) {
    let query = `CALL db.index.fulltext.queryNodes("${indexName}", "${queryValue}") YIELD node RETURN `;
    if (returnProps?.length) {
      const returnProperties = returnProps.map((p) => `node.${p}`).join(', ');
      query += returnProperties;
    } else {
      query += 'node';
    }
    return await this.executeMultipleEntitiesQuery(query, {});
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

  private parseOneRecord(record: any) {
    let response = {};
    record.keys.forEach((key) => {
      const value = record.get(key);
      if (typeof value === 'object') {
        const entityProperties = value.properties;
        this.excludedProperties.forEach((p) => delete entityProperties[p]);
        response = entityProperties;
      } else {
        const objKey = key.slice(0, key.indexOf('.'));
        if (response[objKey] === undefined) {
          response[objKey] = {};
        }
        response[objKey][key.slice(key.indexOf('.') + 1)] = value;
      }
    });
    const keys = Object.keys(response);
    if (keys.length === 1) {
      response = response[keys[0]];
    }
    return response;
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
      return this.parseOneRecord(res.records[0]);
    } catch (e) {
      throw new Error(e);
    }
  }

  private async executeMultipleEntitiesQuery(query: string, props: any) {
    try {
      const res = await this.neo4jService.write(query, props);
      return res.records.map((r) => this.parseOneRecord(r));
    } catch (e) {
      throw new Error(e);
    }
  }
}
