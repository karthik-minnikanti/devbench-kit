import { Editor } from '@monaco-editor/react';

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: string;
}

export function ScriptEditor({ value, onChange, placeholder = '// Write your script here...', height = '200px' }: ScriptEditorProps) {
  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden" style={{ height }}>
      <Editor
        height={height}
        defaultLanguage="javascript"
        value={value}
        onChange={(val) => onChange(val || '')}
        theme={document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light'}
        options={{
          minimap: { enabled: false },
          fontSize: 12,
          wordWrap: 'on',
          padding: { top: 8, bottom: 8 },
          automaticLayout: true,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,
          tabSize: 2,
        }}
      />
    </div>
  );
}

