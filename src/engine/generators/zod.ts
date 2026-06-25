import { FieldType } from '../types';

export interface GeneratorOptions {
  rootName?: string;
}

export function generate(root: FieldType, options: GeneratorOptions = {}): string {
  const rootName = options.rootName || 'Root';
  return generateSchema(root, rootName);
}

function generateSchema(field: FieldType, name: string): string {
  if (field.type === 'object' && field.children) {
    const properties = field.children.map(child => {
      let schema = generateFieldSchema(child);

      if (child.optional) {
        schema = `${schema}.optional()`;
      }

      if (child.nullable) {
        schema = `${schema}.nullable()`;
      }

      return `  ${child.name}: ${schema},`;
    }).join('\n');

    return `const ${name}Schema = z.object({\n${properties}\n});`;
  }

  return `const ${name}Schema = z.object({});`;
}

function generateFieldSchema(field: FieldType): string {
  if (field.array) {
    const itemType = field.arrayItemType || field.type;
    const itemSchema = mapTypeToZod(itemType);
    return `z.array(${itemSchema})`;
  }

  if (field.type === 'object' && field.children) {
    const properties = field.children.map(child => {
      let schema = generateFieldSchema(child);
      if (child.optional) schema = `${schema}.optional()`;
      if (child.nullable) schema = `${schema}.nullable()`;
      return `  ${child.name}: ${schema},`;
    }).join('\n');

    return `z.object({\n${properties}\n})`;
  }

  return mapTypeToZod(field.type);
}

function mapTypeToZod(type: string): string {
  switch (type) {
    case 'string': return 'z.string()';
    case 'number': return 'z.number()';
    case 'boolean': return 'z.boolean()';
    case 'null': return 'z.null()';
    case 'array': return 'z.array(z.any())';
    case 'object': return 'z.object({})';
    default: return 'z.any()';
  }
}


