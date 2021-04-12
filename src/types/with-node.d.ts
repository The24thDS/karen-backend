import SourceNode from './source-node';

interface WithNode extends SourceNode {
  relation: {
    label: string;
    direction: 'from-source' | 'towards-source' | 'none';
  };
}

export default WithNode;
