import { FieldType, ValueType } from '../types';

export interface GeneratorOptions {
  rootName?: string;
  useInterfaces?: boolean;
}

export function generate(root: FieldType, options: GeneratorOptions = {}): string {
  const rootName = options.rootName || 'Root';
  const useInterfaces = options.useInterfaces !== false;

  if (useInterfaces) {
    return generateInterface(root, rootName);
  } else {
    return generateType(root, rootName);
  }
}

function generateInterface(field: FieldType, name: string): string {
  if (field.type === 'object' && field.children) {
    const children = field.children.map(child => {
      const optional = child.optional ? '?' : '';
      const nullable = child.nullable ? ' | null' : '';
      const array = child.array ? '[]' : '';

      if (child.type === 'object' && child.children) {
        return `  ${child.name}${optional}: ${generateInterface(child, capitalize(child.name))}${nullable}${array};`;
      }

      const typeName = mapTypeToTypeScript(child.type);
      return `  ${child.name}${optional}: ${typeName}${nullable}${array};`;
    }).join('\n');

    return `interface ${name} {\n${children}\n}`;
  }

  return `interface ${name} {\n  // Empty object\n}`;
}

function generateType(field: FieldType, name: string): string {
  if (field.type === 'object' && field.children) {
    const children = field.children.map(child => {
      const optional = child.optional ? '?' : '';
      const nullable = child.nullable ? ' | null' : '';
      const array = child.array ? '[]' : '';

      if (child.type === 'object' && child.children) {
        return `  ${child.name}${optional}: ${generateType(child, capitalize(child.name))}${nullable}${array};`;
      }

      const typeName = mapTypeToTypeScript(child.type);
      return `  ${child.name}${optional}: ${typeName}${nullable}${array};`;
    }).join('\n');

    return `type ${name} = {\n${children}\n};`;
  }

  return `type ${name} = {};`;
}

function mapTypeToTypeScript(type: ValueType): string {
  switch (type) {
    case 'string': return 'string';
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'null': return 'null';
    case 'array': return 'any[]';
    case 'object': return 'object';
    default: return 'any';
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}


