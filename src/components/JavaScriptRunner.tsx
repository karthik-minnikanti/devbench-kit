import { useState, useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import { runJavaScriptCodeInMainProcess } from '../utils/jsRunner';
import { addHistoryEntry } from '../services/history';
import { useStore } from '../state/store';
import { getSnippets, saveSnippet, loadSnippet, deleteSnippet, Snippet } from '../services/snippets';

export function JavaScriptRunner() {
  const loadHistory = useStore((state) => state.loadHistory);
  const [code, setCode] = useState(`// Enter your JavaScript code here
console.log("Hello, World!");

// Example: Process JSON
const data = { name: "test", value: 123 };
console.log("Data:", JSON.stringify(data, null, 2));

// Example: Calculations
const result = 10 + 20;
console.log("Result:", result);
`);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [executionTime, setExecutionTime] = useState(0);
  const [timeoutMs, setTimeoutMs] = useState(5000);

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [autoSaveInterval, setAutoSaveInterval] = useState(30000);
  const [saveOnRun, setSaveOnRun] = useState(false);
  const [currentSnippetId, setCurrentSnippetId] = useState<string | null>(null);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [showSnippetModal, setShowSnippetModal] = useState(false);
  const [snippetName, setSnippetName] = useState<string>('');
  const [installingPackage, setInstallingPackage] = useState(false);
  const [packageName, setPackageName] = useState('');
  const [installedPackages, setInstalledPackages] = useState<string[]>([]);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadSnippets();
    loadInstalledPackages();
  }, []);

  useEffect(() => {
    if (autoSaveEnabled && autoSaveInterval > 0) {
      autoSaveTimerRef.current = setInterval(() => {
        handleAutoSave();
      }, autoSaveInterval);
    } else {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [autoSaveEnabled, autoSaveInterval, code, currentSnippetId]);

  const loadSnippets = async () => {
    const loadedSnippets = await getSnippets();
    setSnippets(loadedSnippets);
  };

  const loadInstalledPackages = async () => {
    // Wait for Electron API to be available
    let retries = 0;
    while (!window.electronAPI && retries < 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }

    if (!window.electronAPI) {
      console.error('Electron API not available after waiting');
      return;
    }

    try {
      const result = await window.electronAPI.npm.list();
      if (result.success) {
        setInstalledPackages(result.packages || []);
      }
    } catch (err) {
      console.error('Failed to load packages:', err);
    }
  };

  const handleAutoSave = async () => {
    if (currentSnippetId) {
      await saveSnippet({ name: snippetName || 'Untitled', code }, currentSnippetId);
    }
  };

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setOutput('');

    try {
      const result = await runJavaScriptCodeInMainProcess(code, timeoutMs);
      setOutput(result.output);
      setError(result.error);
      setExecutionTime(result.executionTime);

      if (saveOnRun && !result.error) {
        if (currentSnippetId) {
          await saveSnippet({ name: snippetName || 'Untitled', code }, currentSnippetId);
        } else {
          await addHistoryEntry({
            type: 'js-snippet',
            code,
            output: result.output,
          });
          await loadHistory();
        }
      }

      if (!result.error && result.output) {
        await addHistoryEntry({
          type: 'js-snippet',
          code,
          output: result.output,
        });
        await loadHistory();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed');
      setOutput('');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSnippet = async () => {
    if (!snippetName.trim()) {
      alert('Please enter a snippet name');
      return;
    }

    try {
      const result = await saveSnippet({ name: snippetName, code }, currentSnippetId || undefined);
      if (result.success && result.snippet) {
        setCurrentSnippetId(result.snippet.id);
        setShowSnippetModal(false);
        await loadSnippets();
      }
    } catch (err) {
      alert('Failed to save snippet');
    }
  };

  const handleLoadSnippet = async (snippetId: string) => {
    const snippet = await loadSnippet(snippetId);
    if (snippet) {
      setCode(snippet.code || '');
      setSnippetName(snippet.name || '');
      setCurrentSnippetId(snippet.id);
    }
  };

  const handleDeleteSnippet = async (snippetId: string) => {
    if (confirm('Delete this snippet?')) {
      await deleteSnippet(snippetId);
      if (currentSnippetId === snippetId) {
        setCurrentSnippetId(null);
        setSnippetName('');
      }
      await loadSnippets();
    }
  };

  const handleInstallPackage = async () => {
    if (!packageName.trim()) return;

    setInstallingPackage(true);
    try {
      // Wait for Electron API to be available
      let retries = 0;
      while (!window.electronAPI && retries < 10) {
        await new Promise<void>(resolve => window.setTimeout(resolve, 100));
        retries++;
      }

      if (!window.electronAPI) {
        throw new Error('Electron API not available. Please restart the app or check the console for errors.');
      }

      const result = await window.electronAPI.npm.install(packageName);
      if (result.success) {
        const installedName = packageName;
        setPackageName('');
        await loadInstalledPackages();
        alert(`Package "${installedName}" installed successfully!`);
      } else {
        alert(`Failed to install package: ${result.error}`);
      }
    } catch (err) {
      alert(`Failed to install package: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setInstallingPackage(false);
    }
  };

  const handleClear = () => {
    setCode('');
    setOutput('');
    setError(null);
    setCurrentSnippetId(null);
    setSnippetName('');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-100/50 dark:border-gray-800/50 bg-gradient-to-r from-gray-50/30 to-transparent dark:from-gray-800/30 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 tracking-tight">
          <span className="text-lg">⚡</span>
          JavaScript Runner
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={currentSnippetId || ''}
            onChange={(e) => {
              if (e.target.value) {
                handleLoadSnippet(e.target.value);
              } else {
                setCurrentSnippetId(null);
                setSnippetName('');
              }
            }}
            className="input-field text-xs w-40"
          >
            <option value="">New Snippet</option>
            {snippets.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <button
            onClick={() => setShowSnippetModal(true)}
            className="btn-secondary text-xs"
          >
            💾 Save
          </button>

          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSaveEnabled}
              onChange={(e) => setAutoSaveEnabled(e.target.checked)}
              className="w-3 h-3"
            />
            <span>Auto</span>
          </label>
          {autoSaveEnabled && (
            <input
              type="number"
              value={autoSaveInterval > 0 ? autoSaveInterval / 1000 : 30}
              onChange={(e) => {
                const val = Number(e.target.value);
                setAutoSaveInterval(val > 0 ? val * 1000 : 30000);
              }}
              placeholder="Interval (s)"
              className="w-20 input-field text-xs"
              min="1"
            />
          )}

          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={saveOnRun}
              onChange={(e) => setSaveOnRun(e.target.checked)}
              className="w-3 h-3"
            />
            <span>Save on Run</span>
          </label>

          <input
            type="number"
            value={timeoutMs || 5000}
            onChange={(e) => {
              const val = Number(e.target.value);
              setTimeoutMs(val > 0 ? val : 5000);
            }}
            placeholder="Timeout (ms)"
            className="w-28 input-field text-xs"
            min="100"
          />
          <button
            onClick={handleClear}
            className="btn-secondary text-xs"
          >
            🗑️ Clear
          </button>
          <button
            onClick={handleRun}
            disabled={loading}
            className="btn-primary text-xs disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {loading ? '⏳ Running...' : '▶️ Run Code'}
          </button>
        </div>
      </div>

      <div className="px-6 py-2 border-b border-gray-100/50 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/30 flex items-center gap-2 flex-shrink-0">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">NPM:</span>
        <input
          type="text"
          value={packageName || ''}
          onChange={(e) => setPackageName(e.target.value || '')}
          placeholder="Package name (e.g., lodash)"
          className="input-field text-xs flex-1 max-w-xs"
          onKeyPress={(e) => e.key === 'Enter' && handleInstallPackage()}
        />
        <button
          onClick={handleInstallPackage}
          disabled={installingPackage || !packageName.trim()}
          className="btn-secondary text-xs disabled:opacity-50"
        >
          {installingPackage ? '⏳ Installing...' : '📦 Install'}
        </button>
        {installedPackages.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span>Installed:</span>
            <span className="font-mono">{installedPackages.join(', ')}</span>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden gap-2 p-2">
        <div className="flex-1 flex flex-col card shadow-soft overflow-hidden">
          <div className="px-4 py-2.5 bg-gradient-to-r from-gray-50/80 to-transparent dark:from-gray-800/50 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800">
            <div className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
              JavaScript Code {currentSnippetId && `(${snippetName})`}
            </div>
          </div>
          <div className="flex-1" style={{ backgroundColor: '#1e1e1e' }}>
            <Editor
              height="100%"
              width="100%"
              defaultLanguage="javascript"
              value={code}
              onChange={(value) => setCode(value || '')}
              theme="vs-dark"
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
          <div className="px-4 py-2.5 bg-gradient-to-r from-gray-50/80 to-transparent dark:from-gray-800/50 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              Output
            </div>
            {executionTime > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {executionTime}ms
              </span>
            )}
          </div>
          <div className="flex-1 relative">
            <Editor
              height="100%"
              width="100%"
              defaultLanguage="plaintext"
              value={output || (error ? `Error: ${error}` : '// Output will appear here...\n// Use require() to import installed npm packages')}
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

      {showSnippetModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-96 shadow-soft-lg">
            <h3 className="text-lg font-bold mb-4">Save Snippet</h3>
            <input
              type="text"
              value={snippetName || ''}
              onChange={(e) => setSnippetName(e.target.value || '')}
              placeholder="Snippet name"
              className="input-field w-full mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowSnippetModal(false);
                  setSnippetName('');
                }}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSnippet}
                className="btn-primary text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


