import { ValueType, FieldType } from './types';
import { lenientJsonParse } from '../utils/lenientJsonParser';

export function inferFromJsonString(jsonString: string): FieldType {
  try {
    const obj = lenientJsonParse(jsonString);
    return inferValue('root', obj);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function inferValue(name: string, value: any): FieldType {
  if (value === null) {
    return {
      name,
      type: 'null',
      optional: false,
      nullable: true,
      array: false,
    };
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return {
        name,
        type: 'array',
        optional: false,
        nullable: false,
        array: true,
        arrayItemType: 'null',
      };
    }

    const itemTypes = value.map(item => inferValueType(item));
    const unifiedType = unifyTypes(itemTypes);

    return {
      name,
      type: unifiedType,
      optional: false,
      nullable: false,
      array: true,
      arrayItemType: unifiedType,
      children: unifiedType === 'object' && value.length > 0
        ? inferObjectFields(value[0])
        : undefined,
    };
  }

  if (typeof value === 'object') {
    return {
      name,
      type: 'object',
      optional: false,
      nullable: false,
      array: false,
      children: inferObjectFields(value),
    };
  }

  return {
    name,
    type: inferValueType(value),
    optional: false,
    nullable: false,
    array: false,
  };
}

function inferValueType(value: any): ValueType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

function inferObjectFields(obj: any): FieldType[] {
  const fields: FieldType[] = [];

  for (const [key, value] of Object.entries(obj)) {
    fields.push(inferValue(key, value));
  }

  return fields;
}

function unifyTypes(types: ValueType[]): ValueType {
  const uniqueTypes = [...new Set(types)];

  if (uniqueTypes.length === 1) {
    return uniqueTypes[0];
  }

  if (uniqueTypes.includes('null')) {
    const nonNullTypes = uniqueTypes.filter(t => t !== 'null');
    if (nonNullTypes.length === 1) {
      return nonNullTypes[0];
    }
  }

  if (uniqueTypes.includes('number') && uniqueTypes.includes('string')) {
    return 'string';
  }

  if (uniqueTypes.includes('object') && uniqueTypes.length > 1) {
    return 'object';
  }

  return uniqueTypes[0] || 'string';
}


