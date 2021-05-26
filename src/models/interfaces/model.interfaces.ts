import { Neo4jNumber } from '../../utils/interfaces/neo4j.interfaces';

export interface ModelFile {
  name: string;
  size: string;
  type: string;
}

export interface Model {
  id: string;
  name: string;
  slug: string;
  images: string[];
  gltf: string;
  description: string;
  totalVertexCount: number;
  totalTriangleCount: number;
  downloads: number;
  views: number;
  rating?: number;
  isUpvoted?: boolean;
  isDownvoted?: boolean;
  metadata?: string;
  created_at: Neo4jNumber;
}

export interface ModelWithFiles extends Model {
  files: ModelFile[];
}

export interface ModelWithDateString
  extends Omit<ModelWithFiles, 'created_at'> {
  created_at: string;
}

export interface FindOneQueryResponse extends Model {
  relType: string;
  user: { username: string };
  nodes: string[] | ModelFile[];
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
