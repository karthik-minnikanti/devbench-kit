import { useState } from 'react';
import { Editor } from '@monaco-editor/react';
import { useStore } from '../state/store';
import * as typescriptGenerator from '../engine/generators/typescript';
import * as zodGenerator from '../engine/generators/zod';
import * as prismaGenerator from '../engine/generators/prisma';
import * as mongooseGenerator from '../engine/generators/mongoose';
import { inferFromJsonString } from '../engine/inference';

type SchemaType = 'typescript' | 'zod' | 'prisma' | 'mongoose';

const schemaTypes: { id: SchemaType; label: string }[] = [
  { id: 'typescript', label: 'TypeScript' },
  { id: 'zod', label: 'Zod' },
  { id: 'prisma', label: 'Prisma' },
  { id: 'mongoose', label: 'Mongoose' },
];

export function OutputTabs() {
  const jsonInput = useStore((state) => state.jsonInput);
  const selectedSchemaType = useStore((state) => state.selectedSchemaType);
  const setSelectedSchemaType = useStore((state) => state.setSelectedSchemaType);
  const generatedOutput = useStore((state) => state.generatedOutput);

  const generateOutput = () => {
    if (!jsonInput.trim()) {
      return '// Please enter JSON input';
    }

    try {
      const root = inferFromJsonString(jsonInput);
      switch (selectedSchemaType) {
        case 'typescript':
          return typescriptGenerator.generate(root, { rootName: 'Root' });
        case 'zod':
          return zodGenerator.generate(root, { rootName: 'Root' });
        case 'prisma':
          return prismaGenerator.generate(root, { rootName: 'Root' });
        case 'mongoose':
          return mongooseGenerator.generate(root, { rootName: 'Root' });
        default:
          return '// Unknown schema type';
      }
    } catch (error) {
      return `// Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  };

  const output = generatedOutput || generateOutput();

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-0.5">
          {schemaTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedSchemaType(type.id)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-all duration-150 ${selectedSchemaType === type.id
                ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900'
                }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          width="100%"
          defaultLanguage={selectedSchemaType === 'typescript' ? 'typescript' : 'plaintext'}
          value={output}
          theme={document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light'}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
            padding: { top: 16, bottom: 16 },
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}

