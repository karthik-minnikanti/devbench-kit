import { create } from 'zustand';
import { inferFromJsonString } from '../engine/inference';
import * as typescriptGenerator from '../engine/generators/typescript';
import * as zodGenerator from '../engine/generators/zod';
import * as prismaGenerator from '../engine/generators/prisma';
import * as mongooseGenerator from '../engine/generators/mongoose';
import { getConfig, setConfig, Config } from '../services/config';
import { getHistory, HistoryEntry } from '../services/history';
// License validation removed - no longer required
type LicenseStatus = 'valid' | 'invalid' | 'expired';

export type SchemaType = 'typescript' | 'zod' | 'prisma' | 'mongoose';

interface AppState {
  jsonInput: string;
  selectedSchemaType: SchemaType;
  generatedOutput: string;
  history: HistoryEntry[];
  config: Config | null;
  licenseStatus: LicenseStatus | null;
  currentProjectPath: string | null;

  setJsonInput: (input: string) => void;
  setSelectedSchemaType: (type: SchemaType) => void;
  generateSchema: () => void;
  loadHistory: () => Promise<void>;
  loadConfig: () => Promise<void>;
  checkLicense: () => Promise<void>;
  setCurrentProjectPath: (path: string | null) => void;
  setTheme: (theme: Config['theme']) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  jsonInput: '',
  selectedSchemaType: 'typescript',
  generatedOutput: '',
  history: [],
  config: null,
  licenseStatus: null,
  currentProjectPath: null,

  setJsonInput: (input: string) => set({ jsonInput: input }),
  setSelectedSchemaType: (type: SchemaType) => set({ selectedSchemaType: type }),

  generateSchema: () => {
    const { jsonInput, selectedSchemaType } = get();
    if (!jsonInput.trim()) {
      set({ generatedOutput: '// Please enter JSON input' });
      return;
    }

    try {
      const root = inferFromJsonString(jsonInput);
      let output = '';
      switch (selectedSchemaType) {
        case 'typescript':
          output = typescriptGenerator.generate(root, { rootName: 'Root' });
          break;
        case 'zod':
          output = zodGenerator.generate(root, { rootName: 'Root' });
          break;
        case 'prisma':
          output = prismaGenerator.generate(root, { rootName: 'Root' });
          break;
        case 'mongoose':
          output = mongooseGenerator.generate(root, { rootName: 'Root' });
          break;
      }
      set({ generatedOutput: output });
    } catch (error) {
      set({
        generatedOutput: `// Error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  },

  loadHistory: async () => {
    const history = await getHistory();
    set({ history });
  },

  loadConfig: async () => {
    const config = await getConfig();
    // Always force light theme - reset if dark is cached
    if (config.theme === 'dark') {
      const newConfig = { ...config, theme: 'light' as const };
      await setConfig(newConfig);
      set({ config: newConfig });
    } else {
      set({ config });
    }
  },

  checkLicense: async () => {
    // License validation removed - always return valid
    set({ licenseStatus: 'valid' as LicenseStatus });
  },

  setCurrentProjectPath: (path: string | null) => set({ currentProjectPath: path }),

  setTheme: async (theme: Config['theme']) => {
    // Always force light theme
    const { config } = get();
    const newConfig: Config = { ...config, theme: 'light' };
    await setConfig(newConfig);
    set({ config: newConfig });
  },
}));

