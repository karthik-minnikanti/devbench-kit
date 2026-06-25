import { FieldType } from '../types';

export interface GeneratorOptions {
  rootName?: string;
}

export function generate(root: FieldType, options: GeneratorOptions = {}): string {
  const rootName = options.rootName || 'Model';
  return generateModel(root, rootName);
}

function generateModel(field: FieldType, name: string): string {
  if (field.type === 'object' && field.children) {
    const fields = field.children.map(child => {
      const type = mapTypeToPrisma(child);
      const optional = child.optional ? '?' : '';
      return `  ${child.name} ${type}${optional}`;
    }).join('\n');

    return `model ${name} {\n${fields}\n}`;
  }

  return `model ${name} {\n  // Empty model\n}`;
}

function mapTypeToPrisma(field: FieldType): string {
  if (field.array) {
    const itemType = field.arrayItemType || field.type;
    return `String[]`; // Prisma arrays are typically String[], Int[], etc.
  }

  switch (field.type) {
    case 'string': return 'String';
    case 'number': return 'Int';
    case 'boolean': return 'Boolean';
    case 'null': return 'String?';
    case 'object': return 'Json';
    case 'array': return 'String[]';
    default: return 'String';
  }
}


