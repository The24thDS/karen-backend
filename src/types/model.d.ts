import Tag from './tag';

interface Model {
  name: string;
  id: string;
  tags?: Tag[];
  images: string[];
  files: string[];
}

export default Model;
