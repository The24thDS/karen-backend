import { StrippedModelWithUsername } from 'src/models/interfaces/model.interfaces';
import { RequestUser } from 'src/users/interfaces/user.interface';

export interface Collection {
  id: string;
  slug: string;
  private: boolean;
  name: string;
  description: string;
  created: string;
  updated: string;
}

export interface CollectionWithUser extends Collection {
  user: RequestUser;
}

export interface CollectionWithModels extends Collection {
  models: StrippedModelWithUsername[];
}
