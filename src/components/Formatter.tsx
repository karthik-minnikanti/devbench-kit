import { useState } from 'react';
import { Editor } from '@monaco-editor/react';
import {
  formatJson,
  minifyJson,
  formatXml,
  removeNewlines,
  replaceDoubleQuotesWithSingle,
  addQuotesToKeys,
  escapeJsonForPostman,
} from '../utils/formatters';

type FormatType = 'json-format' | 'json-minify' | 'xml-format' | 'remove-newlines' | 'quotes-single' | 'postman-keys' | 'postman-escape';

export function Formatter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<FormatType>('json-format');

  const handleFormat = () => {
    setError(null);
    try {
      switch (type) {
        case 'json-format':
          setOutput(formatJson(input, 2));
          break;
        case 'json-minify':
          setOutput(minifyJson(input));
          break;
        case 'xml-format':
          setOutput(formatXml(input, 2));
          break;
        case 'remove-newlines':
          setOutput(removeNewlines(input));
          break;
        case 'quotes-single':
          setOutput(replaceDoubleQuotesWithSingle(input));
          break;
        case 'postman-keys':
          setOutput(addQuotesToKeys(input));
          break;
        case 'postman-escape':
          setOutput(escapeJsonForPostman(input));
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Formatting failed');
      setOutput('');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-100/50 dark:border-gray-800/50 bg-gradient-to-r from-gray-50/30 to-transparent dark:from-gray-800/30 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 tracking-tight">
          <span className="text-lg">✨</span>
          Formatter
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as FormatType)}
            className="input-field text-xs"
          >
            <option value="json-format">JSON Format</option>
            <option value="json-minify">JSON Minify</option>
            <option value="xml-format">XML Format</option>
            <option value="remove-newlines">Remove Newlines</option>
            <option value="quotes-single">Single Quotes</option>
            <option value="postman-keys">Add Quotes to Keys</option>
            <option value="postman-escape">Escape for Postman</option>
          </select>
          <button
            onClick={handleFormat}
            className="btn-primary text-xs"
          >
            ⚡ Format
          </button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden gap-2 p-2">
        <div className="flex-1 flex flex-col card shadow-soft overflow-hidden">
          <div className="px-4 py-2.5 bg-gradient-to-r from-gray-50/80 to-transparent dark:from-gray-800/50 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800">
            <div className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
              Input
            </div>
          </div>
          <div className="flex-1">
            <Editor
              height="100%"
              width="100%"
              defaultLanguage="json"
              value={input}
              onChange={(value) => setInput(value || '')}
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
        <div className="flex-1 flex flex-col card shadow-soft overflow-hidden">
          <div className="px-4 py-2.5 bg-gradient-to-r from-gray-50/80 to-transparent dark:from-gray-800/50 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800">
            <div className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              Output
            </div>
          </div>
          <div className="flex-1 relative">
            <Editor
              height="100%"
              width="100%"
              defaultLanguage="json"
              value={output || (error ? `Error: ${error}` : '// Output will appear here...')}
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
            {error && (
              <div className="absolute bottom-4 left-4 right-4 bg-red-500/95 dark:bg-red-600/95 backdrop-blur-sm border border-red-400/50 text-white px-4 py-3 rounded-xl shadow-soft-lg animate-slide-up">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <span className="font-medium">{error}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


