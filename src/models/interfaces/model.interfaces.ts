import { Neo4jNumber } from '../../utils/interfaces/neo4j.interfaces';

export interface Model {
  id: string;
  name: string;
  slug: string;
  files: string[];
  images: string[];
  gltf: string;
  description: string;
  totalVertexCount: number;
  totalTriangleCount: number;
  downloads: number;
  views: number;
  metadata?: string;
  created_at: Neo4jNumber;
}

export interface ModelWithDateString extends Omit<Model, 'created_at'> {
  created_at: string;
}

export interface FindOneQueryResponse extends Model {
  user: { username: string };
  tags: string[];
}

export interface FindOneRequestResponse {
  model: ModelWithDateString;
  user: { username: string };
  tags: string[];
}

export interface StrippedModelWithUsername {
  name: string;
  slug: string;
  image: string;
  user: { username: string };
}
