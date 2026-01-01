import { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { getVariables, saveVariable, deleteVariable, Variable } from '../utils/variables';
import { Folder } from '../utils/folders';

interface VariablesManagerProps {
  folderId?: string | null;
  folders: Folder[];
  onClose: () => void;
  isOpen?: boolean;
}

export function VariablesManager({ folderId, folders, onClose, isOpen = true }: VariablesManagerProps) {
  const [variables, setVariables] = useState<Variable[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(folderId || null);

  useEffect(() => {
    loadVariables();
  }, [selectedFolderId]);

  const loadVariables = async () => {
    setLoading(true);
    try {
      const vars = await getVariables(selectedFolderId);
      setVariables(vars);
    } catch (error) {
      console.error('Failed to load variables:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!newKey.trim()) return;
    
    setLoading(true);
    try {
      const variable: Omit<Variable, 'id' | 'createdAt' | 'updatedAt'> = {
        key: newKey.trim(),
        value: newValue,
        folderId: selectedFolderId,
      };
      
      if (editingId) {
        const saved = await saveVariable({ ...variable, id: editingId });
        if (saved) {
          await loadVariables();
          setEditingId(null);
          setNewKey('');
          setNewValue('');
        }
      } else {
        const saved = await saveVariable(variable);
        if (saved) {
          await loadVariables();
          setNewKey('');
          setNewValue('');
        }
      }
    } catch (error) {
      console.error('Failed to save variable:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (variable: Variable) => {
    setEditingId(variable.id);
    setNewKey(variable.key);
    setNewValue(variable.value);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this variable?')) return;
    
    setLoading(true);
    try {
      const success = await deleteVariable(id);
      if (success) {
        await loadVariables();
      }
    } catch (error) {
      console.error('Failed to delete variable:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setNewKey('');
    setNewValue('');
  };

  const currentVariables = variables.filter(v => {
    if (selectedFolderId === null) {
      return !v.folderId || v.folderId === null;
    }
    return v.folderId === selectedFolderId;
  });

  const selectedFolder = selectedFolderId 
    ? folders.find(f => f.id === selectedFolderId)
    : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[var(--color-card)] rounded-3xl p-8 max-w-2xl w-full mx-4 shadow-2xl border border-[var(--color-border)] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Variables
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Close modal"
          >
            <Icon name="X" className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-6 pb-6 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-sm font-medium text-[var(--color-text-primary)]">Scope:</label>
            <select
              value={selectedFolderId || ''}
              onChange={(e) => setSelectedFolderId(e.target.value || null)}
              className="flex-1 px-3 py-1.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-text-primary)]"
            >
              <option value="">Global</option>
              {folders.map(folder => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {selectedFolderId === null 
              ? 'Global variables are available in all requests'
              : `Variables for folder: ${selectedFolder?.name || 'Unknown'}`
            }
          </p>
        </div>

        <div className="flex-1 overflow-y-auto mb-6">
          {loading && currentVariables.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-text-secondary)]">Loading...</div>
          ) : currentVariables.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-text-secondary)]">
              No variables in this scope. Add one below.
            </div>
          ) : (
            <div className="space-y-2">
              {currentVariables.map((variable, index) => (
                <div
                  key={variable.id || `variable-${index}`}
                  className="flex items-center gap-2 p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-background)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm font-medium truncate text-[var(--color-text-primary)]">
                      {variable.key}
                    </div>
                    <div className="text-xs truncate mt-1 text-[var(--color-text-secondary)]">
                      {variable.value}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(variable)}
                      className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                      <Icon name="PenTool" className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(variable.id)}
                      className="p-1 text-red-500 hover:text-red-600 transition-colors"
                    >
                      <Icon name="Trash2" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-[var(--color-border)] space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Variable key (e.g., baseUrl)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="flex-1 px-3 py-2 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-text-primary)]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newKey.trim()) {
                  handleSave();
                }
              }}
            />
            <input
              type="text"
              placeholder="Variable value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="flex-1 px-3 py-2 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-text-primary)]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newKey.trim()) {
                  handleSave();
                }
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!newKey.trim() || loading}
              className="flex-1 px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors text-sm font-medium"
            >
              {editingId ? 'Update' : 'Add'} Variable
            </button>
            {editingId && (
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-[var(--color-muted)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] rounded-md transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            )}
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Use variables in requests with <code className="px-1 py-0.5 rounded bg-[var(--color-background)]">&#123;&#123;variableName&#125;&#125;</code> syntax
          </p>
        </div>
      </div>
    </div>
  );
}

