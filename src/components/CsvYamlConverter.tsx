import { useState } from 'react';
import { Editor } from '@monaco-editor/react';
import yaml from 'js-yaml';

type ConversionType = 'json-csv' | 'csv-json' | 'json-yaml' | 'yaml-json';

export function CsvYamlConverter() {
    const [conversionType, setConversionType] = useState<ConversionType>('json-csv');
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [csvDelimiter, setCsvDelimiter] = useState(',');

    const jsonToCsv = (jsonStr: string): string => {
        try {
            const data = JSON.parse(jsonStr);
            if (!Array.isArray(data)) {
                throw new Error('JSON must be an array of objects');
            }
            if (data.length === 0) {
                return '';
            }

            const headers = Object.keys(data[0]);
            const rows = data.map((obj) =>
                headers.map((header) => {
                    const value = obj[header];
                    if (value === null || value === undefined) {
                        return '';
                    }
                    const str = String(value);
                    if (str.includes(csvDelimiter) || str.includes('"') || str.includes('\n')) {
                        return `"${str.replace(/"/g, '""')}"`;
                    }
                    return str;
                })
            );

            return [headers.join(csvDelimiter), ...rows.map((row) => row.join(csvDelimiter))].join('\n');
        } catch (err) {
            throw new Error(`Failed to convert JSON to CSV: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const csvToJson = (csvStr: string): string => {
        try {
            const lines = csvStr.trim().split('\n');
            if (lines.length === 0) {
                return '[]';
            }

            const headers = lines[0].split(csvDelimiter).map((h) => h.trim().replace(/^"|"$/g, ''));
            const rows = lines.slice(1).map((line) => {
                const values: string[] = [];
                let current = '';
                let inQuotes = false;

                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"') {
                        if (inQuotes && line[i + 1] === '"') {
                            current += '"';
                            i++;
                        } else {
                            inQuotes = !inQuotes;
                        }
                    } else if (char === csvDelimiter && !inQuotes) {
                        values.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
                values.push(current.trim());

                const obj: any = {};
                headers.forEach((header, idx) => {
                    let value = values[idx] || '';
                    value = value.replace(/^"|"$/g, '');
                    obj[header] = value;
                });
                return obj;
            });

            return JSON.stringify(rows, null, 2);
        } catch (err) {
            throw new Error(`Failed to convert CSV to JSON: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const jsonToYaml = (jsonStr: string): string => {
        try {
            const obj = JSON.parse(jsonStr);
            return yaml.dump(obj, { indent: 2 });
        } catch (err) {
            throw new Error(`Failed to convert JSON to YAML: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const yamlToJson = (yamlStr: string): string => {
        try {
            const obj = yaml.load(yamlStr);
            return JSON.stringify(obj, null, 2);
        } catch (err) {
            throw new Error(`Failed to convert YAML to JSON: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const convert = () => {
        setError(null);
        if (!input.trim()) {
            setOutput('');
            return;
        }

        try {
            let result = '';
            switch (conversionType) {
                case 'json-csv':
                    result = jsonToCsv(input);
                    break;
                case 'csv-json':
                    result = csvToJson(input);
                    break;
                case 'json-yaml':
                    result = jsonToYaml(input);
                    break;
                case 'yaml-json':
                    result = yamlToJson(input);
                    break;
            }
            setOutput(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Conversion failed');
            setOutput('');
        }
    };

    const copyOutput = () => {
        navigator.clipboard.writeText(output);
    };

    const getInputLanguage = (): string => {
        if (conversionType === 'json-csv' || conversionType === 'json-yaml') return 'json';
        if (conversionType === 'csv-json') return 'csv';
        if (conversionType === 'yaml-json') return 'yaml';
        return 'plaintext';
    };

    const getOutputLanguage = (): string => {
        if (conversionType === 'csv-json' || conversionType === 'yaml-json') return 'json';
        if (conversionType === 'json-csv') return 'csv';
        if (conversionType === 'json-yaml') return 'yaml';
        return 'plaintext';
    };

    const getExampleInput = (): string => {
        switch (conversionType) {
            case 'json-csv':
                return '[\n  {"name": "John", "age": 30, "city": "NYC"},\n  {"name": "Jane", "age": 25, "city": "LA"}\n]';
            case 'csv-json':
                return 'name,age,city\nJohn,30,NYC\nJane,25,LA';
            case 'json-yaml':
                return '{\n  "name": "John",\n  "age": 30,\n  "city": "NYC"\n}';
            case 'yaml-json':
                return 'name: John\nage: 30\ncity: NYC';
            default:
                return '';
        }
    };

    return (
        <div className="h-full flex flex-col bg-white dark:bg-gray-900">
            <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                        CSV/YAML Converter
                    </div>
                    <select
                        value={conversionType}
                        onChange={(e) => {
                            setConversionType(e.target.value as ConversionType);
                            setInput(getExampleInput());
                            setOutput('');
                            setError(null);
                        }}
                        className="input-field text-xs"
                    >
                        <option value="json-csv">JSON → CSV</option>
                        <option value="csv-json">CSV → JSON</option>
                        <option value="json-yaml">JSON → YAML</option>
                        <option value="yaml-json">YAML → JSON</option>
                    </select>
                    {(conversionType === 'json-csv' || conversionType === 'csv-json') && (
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] text-gray-600 dark:text-gray-400">Delimiter:</label>
                            <input
                                type="text"
                                value={csvDelimiter}
                                onChange={(e) => setCsvDelimiter(e.target.value || ',')}
                                className="w-8 input-field text-xs py-0.5 px-1"
                            />
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setInput(getExampleInput());
                            convert();
                        }}
                        className="btn-secondary text-xs"
                    >
                        Example
                    </button>
                    <button
                        onClick={convert}
                        className="btn-primary text-xs"
                    >
                        Convert
                    </button>
                </div>
            </div>

            {error && (
                <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                    <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
                </div>
            )}

            <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
                {/* Input */}
                <div className="flex-1 flex flex-col border-r border-gray-100 dark:border-gray-800" style={{ minHeight: 0 }}>
                    <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                        <div className="text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase">Input</div>
                    </div>
                    <div className="flex-1" style={{ minHeight: 0 }}>
                        <Editor
                            height="100%"
                            defaultLanguage={getInputLanguage()}
                            value={input}
                            onChange={(value) => setInput(value || '')}
                            theme={document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light'}
                            options={{
                                minimap: { enabled: false },
                                fontSize: 12,
                                wordWrap: 'on',
                                automaticLayout: true,
                            }}
                        />
                    </div>
                </div>

                {/* Output */}
                <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
                    <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <div className="text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase">Output</div>
                        {output && (
                            <button
                                onClick={copyOutput}
                                className="btn-tertiary text-[10px]"
                            >
                                Copy
                            </button>
                        )}
                    </div>
                    <div className="flex-1" style={{ minHeight: 0 }}>
                        <Editor
                            height="100%"
                            defaultLanguage={getOutputLanguage()}
                            value={output || 'Click "Convert" to see result'}
                            onChange={(value) => setOutput(value || '')}
                            theme={document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light'}
                            options={{
                                minimap: { enabled: false },
                                fontSize: 12,
                                wordWrap: 'on',
                                automaticLayout: true,
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

