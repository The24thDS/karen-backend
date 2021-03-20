import Model from 'src/types/model';
import Tag from 'src/types/tag';

export const ParseModel = (records: any[]): Model => {
  const modelProperties = records[0].get('model').properties;
  const parsedModel: Model = {
    ...modelProperties,
  };
  if (records[0].has('tag')) {
    parsedModel.tags = records.map(
      (record): Tag => record.get('tag').properties,
    );
  }
  return parsedModel;
};

export const ParseModels = (records: any[]): Model[] => {
  const parsedModels: Model[] = records.map(
    (record): Model => ParseModel([record]),
  );
  return parsedModels;
};
