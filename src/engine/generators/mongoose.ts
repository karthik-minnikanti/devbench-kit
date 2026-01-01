import { FieldType } from '../types';

export interface GeneratorOptions {
  rootName?: string;
}

export function generate(root: FieldType, options: GeneratorOptions = {}): string {
  const rootName = options.rootName || 'Model';
  return generateSchema(root, rootName);
}

function generateSchema(field: FieldType, name: string): string {
  if (field.type === 'object' && field.children) {
    const fields = field.children.map(child => {
      const schema = generateFieldSchema(child);
      return `  ${child.name}: ${schema},`;
    }).join('\n');

    return `const ${name}Schema = new mongoose.Schema({\n${fields}\n});`;
  }

  return `const ${name}Schema = new mongoose.Schema({});`;
}

function generateFieldSchema(field: FieldType): string {
  if (field.array) {
    const itemType = field.arrayItemType || field.type;
    const itemSchema = mapTypeToMongoose(itemType);
    return `[${itemSchema}]`;
  }

  if (field.type === 'object' && field.children) {
    const nestedFields = field.children.map(child => {
      const schema = generateFieldSchema(child);
      return `    ${child.name}: ${schema},`;
    }).join('\n');

    return `{\n${nestedFields}\n  }`;
  }

  const baseType = mapTypeToMongoose(field.type);
  const optional = field.optional ? '{ type: ' + baseType + ', required: false }' : baseType;
  const nullable = field.nullable ? '{ type: ' + baseType + ', default: null }' : optional;

  return nullable;
}

function mapTypeToMongoose(type: string): string {
  switch (type) {
    case 'string': return 'String';
    case 'number': return 'Number';
    case 'boolean': return 'Boolean';
    case 'null': return 'String';
    case 'object': return 'mongoose.Schema.Types.Mixed';
    case 'array': return '[String]';
    default: return 'String';
  }
}


