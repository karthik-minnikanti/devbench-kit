import { Editor } from '@monaco-editor/react';
import { useStore } from '../state/store';

export function JsonEditor() {
  const jsonInput = useStore((state) => state.jsonInput);
  const setJsonInput = useStore((state) => state.setJsonInput);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
        <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          JSON Input
        </div>
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          width="100%"
          defaultLanguage="json"
          value={jsonInput}
          onChange={(value) => setJsonInput(value || '')}
          theme={document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light'}
          options={{
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


