import { useState } from 'react';
import { Editor } from '@monaco-editor/react';
import { jsonToXml, xmlToJson } from '../utils/jsonXmlConverter';

type ConversionType = 'json-to-xml' | 'xml-to-json';

export function JsonXmlConverter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<ConversionType>('json-to-xml');

  const handleConvert = () => {
    setError(null);
    try {
      if (type === 'json-to-xml') {
        setOutput(jsonToXml(input, 'root'));
      } else {
        setOutput(xmlToJson(input));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
      setOutput('');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-100/50 dark:border-gray-800/50 bg-gradient-to-r from-gray-50/30 to-transparent dark:from-gray-800/30 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 tracking-tight">
          <span className="text-lg">🔄</span>
          JSON ↔ XML Converter
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ConversionType)}
            className="input-field text-xs"
          >
            <option value="json-to-xml">JSON → XML</option>
            <option value="xml-to-json">XML → JSON</option>
          </select>
          <button
            onClick={handleConvert}
            className="btn-primary text-xs"
          >
            ⚡ Convert
          </button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden gap-2 p-2">
        <div className="flex-1 flex flex-col card shadow-soft overflow-hidden">
          <div className="px-4 py-2.5 bg-gradient-to-r from-gray-50/80 to-transparent dark:from-gray-800/50 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800">
            <div className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
              {type === 'json-to-xml' ? 'JSON' : 'XML'}
            </div>
          </div>
          <div className="flex-1">
            <Editor
              height="100%"
              width="100%"
              defaultLanguage={type === 'json-to-xml' ? 'json' : 'xml'}
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
              {type === 'json-to-xml' ? 'XML' : 'JSON'}
            </div>
          </div>
          <div className="flex-1 relative">
            <Editor
              height="100%"
              width="100%"
              defaultLanguage={type === 'json-to-xml' ? 'xml' : 'json'}
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


