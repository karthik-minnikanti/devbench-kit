import { useState, useEffect } from 'react';
import { parseSwaggerSpec, ParsedSwaggerRequest } from '../utils/swaggerParser';
import { parsePostmanCollection, ParsedPostmanRequest } from '../utils/postmanParser';
import { parseCurl } from '../utils/curlParser';
import { SavedApiRequest } from './ApiClient';
import { Folder } from '../utils/folders';
import { Icon } from './Icon';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (requests: ParsedSwaggerRequest[] | ParsedPostmanRequest[]) => void;
  onImportCurl?: (parsed: ReturnType<typeof parseCurl>, saveToFolder: boolean, folderId: string | null, requestName: string) => void;
  requests: SavedApiRequest[];
  mode: 'import' | 'export';
  type?: 'swagger' | 'postman' | 'curl';
  folders?: Folder[];
}

export function ImportExportModal({ isOpen, onClose, onImport, onImportCurl, requests, mode, type: initialType, folders = [] }: ImportExportModalProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [importType, setImportType] = useState<'swagger' | 'postman' | 'curl'>(initialType || 'swagger');
  const [importFolderId, setImportFolderId] = useState<string | null>(null);
  const [importRequestName, setImportRequestName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setInput('');
      setError(null);
      setPreviewCount(null);
      setFileName('');
      setImportFolderId(null);
      setImportRequestName('');
      if (initialType) {
        setImportType(initialType);
      }
    }
  }, [isOpen, mode, initialType, requests]);

  // Preview import count when input changes
  useEffect(() => {
    if (mode === 'import' && input.trim()) {
      if (importType === 'curl') {
        try {
          const parsed = parseCurl(input);
          setPreviewCount(parsed ? 1 : null);
          setError(null);
        } catch (e) {
          setPreviewCount(null);
        }
      } else {
        try {
          const parsed = JSON.parse(input);
          let count = 0;
          if (importType === 'swagger') {
            const preview = parseSwaggerSpec(parsed);
            count = preview.length;
          } else {
            const preview = parsePostmanCollection(parsed);
            count = preview.length;
          }
          setPreviewCount(count);
          setError(null);
        } catch (e) {
          setPreviewCount(null);
        }
      }
    } else {
      setPreviewCount(null);
    }
  }, [input, mode, importType]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        setInput(content);
        if (importType === 'curl') {
          const parsed = parseCurl(content);
          setPreviewCount(parsed ? 1 : null);
          setError(null);
        } else {
          const parsed = JSON.parse(content);
          let count = 0;
          if (importType === 'swagger') {
            const preview = parseSwaggerSpec(parsed);
            count = preview.length;
          } else {
            const preview = parsePostmanCollection(parsed);
            count = preview.length;
          }
          setPreviewCount(count);
          setError(null);
        }
      } catch (err) {
        setError('Failed to parse file. Please check the format.');
        setPreviewCount(null);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleImport = (saveToFolder: boolean = false) => {
    try {
      const contentToParse = input.trim();
      if (!contentToParse) {
        setError('Please paste content or select a file');
        return;
      }

      if (importType === 'curl') {
        if (!onImportCurl) {
          setError('cURL import handler not available');
          return;
        }
        const parsed = parseCurl(contentToParse);
        if (!parsed) {
          setError('Failed to parse cURL command. Please check the format.');
          return;
        }
        onImportCurl(parsed, saveToFolder, importFolderId, importRequestName);
        onClose();
        return;
      }

      const parsed = JSON.parse(contentToParse);
      let importedRequests: ParsedSwaggerRequest[] | ParsedPostmanRequest[] = [];

      if (importType === 'swagger') {
        importedRequests = parseSwaggerSpec(parsed);
      } else {
        importedRequests = parsePostmanCollection(parsed);
      }

      if (importedRequests.length === 0) {
        setError('No requests found in the collection');
        return;
      }

      onImport(importedRequests);
      setError(null);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (e) {
      setError('Failed to parse file. Please check the format.');
    }
  };

  if (!isOpen) return null;

  const title = mode === 'import' 
    ? 'Import'
    : `Export ${initialType === 'swagger' ? 'Swagger/OpenAPI' : 'Postman'} Collection`;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[var(--color-card)] rounded-3xl p-8 max-w-2xl w-full mx-4 shadow-2xl border border-[var(--color-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Close modal"
          >
            <Icon name="X" className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          {mode === 'import' ? (
            <>
              <div>
                <label
                  className="block text-sm font-medium mb-2 text-[var(--color-text-primary)]"
                >
                  Import Type
                </label>
                <select
                  value={importType}
                  onChange={(e) => setImportType(e.target.value as 'swagger' | 'postman' | 'curl')}
                  className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-text-primary)]"
                >
                  <option value="curl">cURL Command</option>
                  <option value="swagger">Swagger/OpenAPI</option>
                  <option value="postman">Postman Collection</option>
                </select>
              </div>

              {importType === 'curl' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[var(--color-text-primary)]">Request Name</label>
                    <input
                      type="text"
                      value={importRequestName}
                      onChange={(e) => setImportRequestName(e.target.value)}
                      placeholder="My API Request"
                      className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[var(--color-text-primary)]">Save to Folder (optional)</label>
                    <select
                      value={importFolderId || ''}
                      onChange={(e) => setImportFolderId(e.target.value || null)}
                      className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-text-primary)]"
                    >
                      <option value="">Root</option>
                      {folders.map(folder => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="import-input"
                  className="block text-sm font-medium mb-2 text-[var(--color-text-primary)]"
                >
                  {importType === 'curl' ? 'Paste cURL command' : `${importType === 'swagger' ? 'Swagger/OpenAPI' : 'Postman'} JSON`}
                </label>
                
                {importType !== 'curl' && (
                  <div className="mb-3 flex items-center gap-3">
                    <label
                      htmlFor="file-input"
                      className="px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer text-sm bg-[var(--color-muted)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] border border-[var(--color-border)]"
                    >
                      Choose File
                    </label>
                    <input
                      id="file-input"
                      type="file"
                      accept=".json"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    {fileName && (
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        {fileName}
                      </span>
                    )}
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      or paste below
                    </span>
                  </div>
                )}

                <textarea
                  id="import-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={12}
                  className="w-full px-4 py-3 rounded-lg border resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all font-mono text-sm bg-[var(--color-background)] border-[var(--color-border)] text-[var(--color-text-primary)]"
                  placeholder={importType === 'curl'
                    ? `curl -X POST https://api.example.com/data -H 'Content-Type: application/json' -d '{"key":"value"}'`
                    : importType === 'swagger'
                    ? 'Paste Swagger/OpenAPI JSON spec here or select a file above...'
                    : 'Paste Postman collection JSON here or select a file above...'}
                />

                {previewCount !== null && (
                  <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
                    {previewCount > 0 
                      ? `✓ Found ${previewCount} request${previewCount !== 1 ? 's' : ''} to import`
                      : 'No requests found'}
                  </div>
                )}
              </div>
            </>
          ) : null}

          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-sm text-red-400">
                ✗ {error}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium transition-colors bg-[var(--color-muted)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] border border-[var(--color-border)]"
            >
              Cancel
            </button>
            {mode === 'import' ? (
              <button
                onClick={() => handleImport(false)}
                disabled={!input.trim()}
                className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--color-primary)] hover:opacity-90 text-white"
              >
                Import
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

