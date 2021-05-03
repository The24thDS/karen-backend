import { Neo4jNumber } from '../../utils/interfaces/neo4j.interfaces';

export interface User {
  created_at: Neo4jNumber;
  email: string;
  username: string;
  password: string;
  id: string;
}
