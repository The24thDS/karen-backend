import { format } from 'date-fns';
import { Neo4jNumber } from './interfaces/neo4j.interfaces';

export const parseRecord = (record: any): any => {
  let response = {};
  record.keys.forEach((key) => {
    const value = record.get(key);
    if (
      value instanceof Array ||
      (typeof value === 'string' && !key.includes('.'))
    ) {
      response[key] = value;
    } else if (value === null) {
      response[key] = value;
    } else if (typeof value === 'object') {
      response = value.properties;
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
};

export const formatDate = (
  numberObject: Neo4jNumber,
  dateFormat = 'dd-MM-yyyy HH:mm:ss xxx',
): string => {
  return format(Number(numberObject.toString()), dateFormat);
};
