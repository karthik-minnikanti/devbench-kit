import { useState, useEffect } from 'react';
import { Icon } from './Icon';

export interface Environment {
  id: string;
  name: string;
  variables: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

interface EnvironmentsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  environments: Environment[];
  activeEnvironmentId: string | null;
  onSaveEnvironment: (env: Omit<Environment, 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDeleteEnvironment: (id: string) => Promise<void>;
  onSetActive: (id: string | null) => void;
}

export function EnvironmentsManager({
  isOpen,
  onClose,
  environments,
  activeEnvironmentId,
  onSaveEnvironment,
  onDeleteEnvironment,
  onSetActive,
}: EnvironmentsManagerProps) {
  const [selectedEnv, setSelectedEnv] = useState<Environment | null>(null);
  const [editingEnv, setEditingEnv] = useState<Partial<Environment>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');

  useEffect(() => {
    if (isOpen && environments.length > 0 && !selectedEnv) {
      const active = environments.find(e => e.id === activeEnvironmentId) || environments[0];
      setSelectedEnv(active);
      setEditingEnv({ ...active });
    }
  }, [isOpen, environments, activeEnvironmentId, selectedEnv]);

  if (!isOpen) return null;

  const handleCreateNew = () => {
    const newEnv: Partial<Environment> = {
      id: `env-${Date.now()}`,
      name: 'New Environment',
      variables: {},
    };
    setSelectedEnv(newEnv as Environment);
    setEditingEnv(newEnv);
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!editingEnv.name || !editingEnv.id) return;
    
    await onSaveEnvironment({
      id: editingEnv.id,
      name: editingEnv.name,
      variables: editingEnv.variables || {},
    });
    
    setIsCreating(false);
    setSelectedEnv(editingEnv as Environment);
  };

  const handleDelete = async () => {
    if (!selectedEnv || !confirm(`Delete environment "${selectedEnv.name}"?`)) return;
    await onDeleteEnvironment(selectedEnv.id);
    setSelectedEnv(null);
    setEditingEnv({});
  };

  const handleAddVariable = () => {
    if (!newVarKey.trim()) return;
    setEditingEnv({
      ...editingEnv,
      variables: {
        ...(editingEnv.variables || {}),
        [newVarKey]: newVarValue,
      },
    });
    setNewVarKey('');
    setNewVarValue('');
  };

  const handleRemoveVariable = (key: string) => {
    const newVars = { ...(editingEnv.variables || {}) };
    delete newVars[key];
    setEditingEnv({
      ...editingEnv,
      variables: newVars,
    });
  };

  const handleUpdateVariable = (key: string, value: string) => {
    setEditingEnv({
      ...editingEnv,
      variables: {
        ...(editingEnv.variables || {}),
        [key]: value,
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[var(--color-background)] rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Environments</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[var(--color-muted)] transition-colors"
          >
            <Icon name="X" className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-[var(--color-border)] bg-[var(--color-sidebar)] overflow-y-auto">
            <div className="p-3">
              <button
                onClick={handleCreateNew}
                className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] text-xs hover:bg-[var(--color-muted)] transition-colors flex items-center gap-2"
              >
                <Icon name="Plus" className="w-4 h-4" />
                New Environment
              </button>
            </div>
            <div className="space-y-1 px-2">
              <button
                onClick={() => {
                  onSetActive(null);
                  setSelectedEnv(null);
                  setEditingEnv({});
                }}
                className={`w-full px-3 py-2 rounded text-left text-xs transition-colors ${
                  activeEnvironmentId === null
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]'
                }`}
              >
                No Environment
              </button>
              {environments.map((env) => (
                <button
                  key={env.id}
                  onClick={() => {
                    setSelectedEnv(env);
                    setEditingEnv({ ...env });
                    setIsCreating(false);
                  }}
                  className={`w-full px-3 py-2 rounded text-left text-xs transition-colors flex items-center justify-between ${
                    selectedEnv?.id === env.id
                      ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                      : activeEnvironmentId === env.id
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]'
                  }`}
                >
                  <span className="truncate">{env.name}</span>
                  {activeEnvironmentId === env.id && (
                    <Icon name="Check" className="w-4 h-4 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedEnv ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2">
                    Environment Name
                  </label>
                  <input
                    type="text"
                    value={editingEnv.name || ''}
                    onChange={(e) => setEditingEnv({ ...editingEnv, name: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] text-sm"
                    placeholder="e.g., Development, Staging, Production"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                      Variables
                    </label>
                    <button
                      onClick={() => onSetActive(selectedEnv.id)}
                      className={`px-3 py-1 rounded text-xs transition-colors ${
                        activeEnvironmentId === selectedEnv.id
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-[var(--color-muted)] text-[var(--color-text-primary)] hover:bg-[var(--color-primary)] hover:text-white'
                      }`}
                    >
                      {activeEnvironmentId === selectedEnv.id ? 'Active' : 'Set as Active'}
                    </button>
                  </div>

                  <div className="space-y-2 mb-3">
                    {Object.entries(editingEnv.variables || {}).map(([key, value]) => (
                      <div key={key} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={key}
                          readOnly
                          className="flex-1 px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-sidebar)] text-[var(--color-text-primary)] text-xs"
                        />
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => handleUpdateVariable(key, e.target.value)}
                          className="flex-1 px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] text-xs"
                        />
                        <button
                          onClick={() => handleRemoveVariable(key)}
                          className="p-1.5 text-red-500 hover:text-red-700 transition-colors"
                        >
                          <Icon name="X" className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newVarKey}
                      onChange={(e) => setNewVarKey(e.target.value)}
                      placeholder="Variable name"
                      className="flex-1 px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] text-xs"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddVariable()}
                    />
                    <input
                      type="text"
                      value={newVarValue}
                      onChange={(e) => setNewVarValue(e.target.value)}
                      placeholder="Variable value"
                      className="flex-1 px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] text-xs"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddVariable()}
                    />
                    <button
                      onClick={handleAddVariable}
                      className="px-3 py-1.5 rounded bg-[var(--color-primary)] text-white text-xs hover:opacity-90 transition-opacity"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-[var(--color-border)]">
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 rounded bg-[var(--color-primary)] text-white text-sm hover:opacity-90 transition-opacity"
                  >
                    {isCreating ? 'Create' : 'Save'}
                  </button>
                  {!isCreating && (
                    <button
                      onClick={handleDelete}
                      className="px-4 py-2 rounded border border-red-500 text-red-500 text-sm hover:bg-red-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <Icon name="Folder" className="w-16 h-16 text-[var(--color-text-tertiary)] mx-auto mb-4 opacity-50" />
                  <p className="text-sm text-[var(--color-text-secondary)] mb-2">No environment selected</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">Select an environment or create a new one</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

