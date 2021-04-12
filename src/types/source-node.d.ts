interface SourceNode {
  label: string;
  queryProps?: { [key: string]: string };
  returnProps?: string[];
}

export default SourceNode;
