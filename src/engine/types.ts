export type ValueType = 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object';

export interface FieldType {
  name: string;
  type: ValueType;
  optional: boolean;
  nullable: boolean;
  array: boolean;
  children?: FieldType[];
  arrayItemType?: ValueType;
}


