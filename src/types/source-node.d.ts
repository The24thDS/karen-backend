export interface ReturnProp {
  propName: string;
  alias?: string;
  aggregateFunction?: string;
}

interface SourceNode {
  label: string;
  queryProps?: { [key: string]: string };
  returnProps?: string[] | ReturnProp[];
}

export default SourceNode;
