import { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import { Editor } from '@monaco-editor/react';
import { getFolders, saveFolder, deleteFolder, Folder } from '../utils/folders';
import { groupByDate, DateGroup } from '../utils/dateGrouping';
import { Icon } from './Icon';

interface SavedDiagram {
    id: string;
    name: string;
    code: string;
    folderId?: string | null;
    createdAt: string;
    updatedAt: string;
}

export function UmlEditor() {
    const [code, setCode] = useState(`graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`);

    const [error, setError] = useState<string | null>(null);
    const [splitPosition, setSplitPosition] = useState(() => {
        // Load saved split position or default to 20% (editor) / 80% (preview)
        const saved = localStorage.getItem('uml-split-position');
        return saved ? parseFloat(saved) : 20;
    });
    const [zoom, setZoom] = useState(100); // Percentage
    const [isDragging, setIsDragging] = useState(false);
    const [diagrams, setDiagrams] = useState<SavedDiagram[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [selectedDiagram, setSelectedDiagram] = useState<string | null>(null);
    const [diagramName, setDiagramName] = useState<string>('');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Today', 'Yesterday', 'This Week']));
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [showSidebar, setShowSidebar] = useState(true);
    const [newFolderName, setNewFolderName] = useState('');
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [draggedDiagramId, setDraggedDiagramId] = useState<string | null>(null);
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
    const diagramRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [mermaidInitialized, setMermaidInitialized] = useState(false);

    useEffect(() => {
        loadDiagrams();
        loadFolders();
    }, []);

    const loadDiagrams = () => {
        try {
            const stored = localStorage.getItem('devbench-uml-diagrams');
            if (stored) {
                const parsed = JSON.parse(stored);
                setDiagrams(parsed);
            }
        } catch (err) {
            console.error('Failed to load UML diagrams:', err);
        }
    };

    const loadFolders = async () => {
        try {
            const loadedFolders = getFolders(null);
            loadedFolders.sort((a, b) => {
                const dateA = new Date(a.createdAt || 0).getTime();
                const dateB = new Date(b.createdAt || 0).getTime();
                return dateB - dateA;
            });
            setFolders(loadedFolders);
        } catch (err) {
            console.error('Failed to load folders:', err);
        }
    };

    const saveDiagrams = (updatedDiagrams: SavedDiagram[]) => {
        try {
            localStorage.setItem('devbench-uml-diagrams', JSON.stringify(updatedDiagrams));
            setDiagrams(updatedDiagrams);
        } catch (err) {
            console.error('Failed to save UML diagrams:', err);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            const newFolder = saveFolder({
                name: newFolderName.trim(),
                parentId: null,
            });
            if (newFolder) {
                setNewFolderName('');
                setShowNewFolderInput(false);
                await loadFolders();
            }
        } catch (err) {
            console.error('Failed to create folder:', err);
        }
    };

    const handleDeleteFolder = async (folderId: string) => {
        if (!confirm('Delete this folder? Items inside will be moved to root.')) return;
        try {
            const success = deleteFolder(folderId);
            if (success) {
                const diagramsInFolder = diagrams.filter(d => d.folderId === folderId);
                const updatedDiagrams = diagrams.map(d => {
                    if (d.folderId === folderId) {
                        return { ...d, folderId: null };
                    }
                    return d;
                });
                saveDiagrams(updatedDiagrams);
                await loadFolders();
                await loadDiagrams();
            }
        } catch (err) {
            console.error('Failed to delete folder:', err);
        }
    };

    const handleDragStart = (e: React.DragEvent, diagramId: string) => {
        e.stopPropagation();
        setDraggedDiagramId(diagramId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/x-diagram-id', diagramId);
        e.dataTransfer.setData('text/plain', '');
    };

    const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setDragOverFolderId(folderId);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            setDragOverFolderId(null);
        }
    };

    const handleDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverFolderId(null);

        const diagramId = e.dataTransfer.getData('application/x-diagram-id') || draggedDiagramId;
        if (!diagramId) {
            setDraggedDiagramId(null);
            return;
        }

        const diagram = diagrams.find(d => d.id === diagramId);
        if (!diagram || diagram.folderId === targetFolderId) {
            setDraggedDiagramId(null);
            return;
        }

        try {
            const updatedDiagrams = diagrams.map(d => {
                if (d.id === diagramId) {
                    return { ...d, folderId: targetFolderId };
                }
                return d;
            });
            saveDiagrams(updatedDiagrams);
            if (targetFolderId) {
                setExpandedFolders(prev => new Set(prev).add(targetFolderId));
            }
        } catch (err) {
            console.error('Failed to move diagram:', err);
        } finally {
            setDraggedDiagramId(null);
        }
    };

    const toggleFolder = (folderId: string) => {
        const normalizedId = String(folderId || '');
        if (!normalizedId) return;
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(normalizedId)) {
                newSet.delete(normalizedId);
            } else {
                newSet.add(normalizedId);
            }
            return newSet;
        });
    };

    const getDiagramsInFolder = (folderId: string | null) => {
        if (folderId === null) {
            return diagrams.filter(diagram => diagram.folderId === null || diagram.folderId === undefined);
        } else {
            return diagrams.filter(diagram => diagram.folderId === folderId);
        }
    };

    const toggleGroup = (label: string) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(label)) {
                newSet.delete(label);
            } else {
                newSet.add(label);
            }
            return newSet;
        });
    };

    const handleSelectDiagram = (diagramId: string) => {
        const diagram = diagrams.find(d => d.id === diagramId);
        if (diagram) {
            setSelectedDiagram(diagramId);
            setDiagramName(diagram.name);
            setCode(diagram.code);
        }
    };

    const handleDeleteDiagram = async (diagramId: string) => {
        if (!confirm('Delete this diagram?')) return;
        try {
            const updatedDiagrams = diagrams.filter(d => d.id !== diagramId);
            saveDiagrams(updatedDiagrams);
            if (selectedDiagram === diagramId) {
                setSelectedDiagram(null);
                setDiagramName('');
                setCode(`graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`);
            }
        } catch (err) {
            console.error('Failed to delete diagram:', err);
        }
    };

    const handleSaveDiagram = () => {
        if (!code.trim()) return;
        const savedDiagram: SavedDiagram = {
            id: selectedDiagram || Date.now().toString(),
            name: diagramName || `Diagram ${new Date().toLocaleString()}`,
            code,
            folderId: null,
            createdAt: selectedDiagram ? diagrams.find(d => d.id === selectedDiagram)?.createdAt || new Date().toISOString() : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        if (selectedDiagram) {
            const updatedDiagrams = diagrams.map(d => d.id === selectedDiagram ? savedDiagram : d);
            saveDiagrams(updatedDiagrams);
        } else {
            const updatedDiagrams = [...diagrams, savedDiagram];
            saveDiagrams(updatedDiagrams);
            setSelectedDiagram(savedDiagram.id);
            setDiagramName(savedDiagram.name);
        }
    };

    const handleCreateDiagram = () => {
        setSelectedDiagram(null);
        setDiagramName('');
        setCode(`graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`);
    };

    useEffect(() => {
        const initMermaid = async () => {
            try {
                await mermaid.initialize({
                    startOnLoad: false,
                    theme: 'default',
                    securityLevel: 'loose',
                    flowchart: {
                        useMaxWidth: true,
                        htmlLabels: true,
                    },
                });
                setMermaidInitialized(true);
            } catch (err) {
                console.error('Failed to initialize Mermaid:', err);
                setError('Failed to initialize Mermaid renderer');
            }
        };
        initMermaid();
    }, []);

    const exportToImage = async () => {
        if (!diagramRef.current) {
            setError('No diagram to export');
            return;
        }

        const svgElement = diagramRef.current.querySelector('svg');
        if (!svgElement) {
            setError('No SVG diagram found');
            return;
        }

        try {
            // Use html-to-image to convert SVG directly to PNG
            const { toPng } = await import('html-to-image');

            // Show save dialog first
            const result = await window.electronAPI?.dialog?.saveFile({
                defaultPath: `uml-diagram-${Date.now()}.png`,
                filters: [
                    { name: 'PNG Image', extensions: ['png'] },
                    { name: 'All Files', extensions: ['*'] },
                ],
            });

            if (!result || result.canceled || !result.filePath) {
                return; // User canceled
            }

            // Get SVG dimensions - prefer viewBox, fallback to computed size
            const viewBox = svgElement.viewBox.baseVal;
            let svgWidth = viewBox.width;
            let svgHeight = viewBox.height;

            // If viewBox is not set, use the actual rendered size
            if (!svgWidth || !svgHeight || svgWidth === 0 || svgHeight === 0) {
                const rect = svgElement.getBoundingClientRect();
                svgWidth = rect.width || 1200;
                svgHeight = rect.height || 800;
            }

            // Use very high pixel ratio for crisp, high-resolution images
            // pixelRatio of 4 means 4x the resolution (e.g., 4800x3200 for a 1200x800 SVG)
            const pixelRatio = 4;

            // Convert SVG to PNG with high resolution
            // Using explicit width/height with high pixelRatio ensures maximum quality
            // Cast SVGElement to HTMLElement for html-to-image compatibility
            const dataUrl = await toPng(svgElement as unknown as HTMLElement, {
                backgroundColor: document.documentElement.classList.contains('dark') ? '#1A2023' : '#ffffff',
                width: svgWidth,
                height: svgHeight,
                pixelRatio: pixelRatio,
                cacheBust: true,
                quality: 1.0, // Maximum quality
            });

            // Convert data URL to base64
            const base64 = dataUrl.split(',')[1]; // Remove data:image/png;base64, prefix

            // Save file via Electron
            const writeResult = await window.electronAPI?.file?.writeImage(result.filePath, base64);
            if (!writeResult?.success) {
                setError(writeResult?.error || 'Failed to save file');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to export image');
        }
    };

    useEffect(() => {
        const renderDiagram = async () => {
            // Don't render if Mermaid isn't initialized yet
            if (!mermaidInitialized) {
                return;
            }

            if (!diagramRef.current || !code.trim()) {
                if (diagramRef.current) {
                    diagramRef.current.innerHTML = '';
                }
                setError(null);
                return;
            }

            // Validate that code looks like Mermaid syntax
            const trimmedCode = code.trim();
            if (!trimmedCode || trimmedCode.length < 3) {
                if (diagramRef.current) {
                    diagramRef.current.innerHTML = '';
                }
                setError(null);
                return;
            }

            try {
                setError(null);
                const id = 'mermaid-' + Date.now();
                diagramRef.current.innerHTML = '';

                // Validate syntax first if parse method is available
                if (typeof mermaid.parse === 'function') {
                    try {
                        await mermaid.parse(trimmedCode);
                    } catch (parseError) {
                        // If parse fails, show error but don't try to render
                        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
                        // Clean up error message - remove version info if present
                        const cleanError = errorMessage.replace(/mermaid version \d+\.\d+\.\d+/gi, '').trim();
                        setError(cleanError || 'Invalid Mermaid syntax');
                        if (diagramRef.current) {
                            diagramRef.current.innerHTML = '';
                        }
                        return;
                    }
                }

                // Render the diagram
                const { svg } = await mermaid.render(id, trimmedCode);
                if (diagramRef.current) {
                    diagramRef.current.innerHTML = svg;
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                // Clean up error message - remove version info if present
                const cleanError = errorMessage.replace(/mermaid version \d+\.\d+\.\d+/gi, '').trim();
                setError(cleanError || 'Failed to render diagram');
                if (diagramRef.current) {
                    diagramRef.current.innerHTML = '';
                }
            }
        };

        const timeoutId = setTimeout(() => {
            renderDiagram();
        }, 500); // Debounce rendering

        return () => clearTimeout(timeoutId);
    }, [code, mermaidInitialized]);


    // Resize handler
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !containerRef.current) return;

            const container = containerRef.current;
            const rect = container.getBoundingClientRect();
            const newPosition = ((e.clientX - rect.left) / rect.width) * 100;

            // Clamp between 15% and 85%
            const clampedPosition = Math.max(15, Math.min(85, newPosition));
            setSplitPosition(clampedPosition);
            // Save to localStorage
            localStorage.setItem('uml-split-position', clampedPosition.toString());
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isDragging]);

    const handleZoomIn = () => {
        setZoom(prev => Math.min(prev + 10, 200));
    };

    const handleZoomOut = () => {
        setZoom(prev => Math.max(prev - 10, 50));
    };

    const handleZoomReset = () => {
        setZoom(100);
    };

    // Handle wheel zoom (Ctrl/Cmd + scroll or pinch)
    const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        // Check if Ctrl (Windows/Linux) or Cmd (Mac) is pressed, or if it's a pinch gesture
        if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) {
            e.preventDefault();

            // Determine zoom direction
            const zoomDelta = e.deltaY > 0 ? -5 : 5;
            setZoom(prev => {
                const newZoom = prev + zoomDelta;
                return Math.max(50, Math.min(200, newZoom));
            });
        }
    }, []);

    const examples = [
        {
            name: 'Flowchart',
            code: `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`,
        },
        {
            name: 'Sequence Diagram',
            code: `sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello Bob, how are you?
    B-->>A: Great!
    A->>B: See you later`,
        },
        {
            name: 'Class Diagram',
            code: `classDiagram
    class Animal {
        +String name
        +int age
        +eat()
        +sleep()
    }
    class Dog {
        +String breed
        +bark()
    }
    class Cat {
        +String color
        +meow()
    }
    Animal <|-- Dog
    Animal <|-- Cat`,
        },
        {
            name: 'State Diagram',
            code: `stateDiagram-v2
    [*] --> Idle
    Idle --> Processing: Start
    Processing --> Completed: Success
    Processing --> Error: Failure
    Error --> Idle: Retry
    Completed --> [*]`,
        },
    ];

    const loadExample = (exampleCode: string) => {
        setCode(exampleCode);
    };

    const rootDiagrams = getDiagramsInFolder(null);
    const rootDiagramsGrouped = groupByDate(rootDiagrams);

    return (
        <div className="h-full flex flex-col bg-[var(--color-background)]">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-[var(--color-border)] bg-[var(--color-sidebar)] px-4 py-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowSidebar(!showSidebar)}
                            className="px-2 py-1 rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-primary)] text-xs transition-colors"
                        >
                            {showSidebar ? '←' : '→'}
                        </button>
                        <h2 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">UML Editor</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={diagramName}
                            onChange={(e) => setDiagramName(e.target.value)}
                            placeholder="Diagram name (optional)..."
                            className="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-all"
                        />
                        <button
                            onClick={handleSaveDiagram}
                            className="px-3 py-1.5 text-xs rounded bg-[var(--color-primary)] text-white font-medium hover:opacity-90 transition-opacity"
                            title="Save Diagram"
                        >
                            Save
                        </button>
                        <button
                            onClick={handleCreateDiagram}
                            className="px-3 py-1.5 text-xs rounded bg-[var(--color-primary)] text-white font-medium hover:opacity-90 transition-opacity"
                        >
                            + New
                        </button>
                        <select
                            onChange={(e) => {
                                const example = examples.find(ex => ex.name === e.target.value);
                                if (example) loadExample(example.code);
                                e.target.value = '';
                            }}
                            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                            defaultValue=""
                        >
                            <option value="" disabled>Load Example...</option>
                            {examples.map((ex) => (
                                <option key={ex.name} value={ex.name}>
                                    {ex.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
                {showSidebar && (
                    <div className="w-56 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-sidebar)] overflow-y-auto">
                        <div className="p-2 flex-1"
                            onDragOver={(e) => {
                                if (draggedDiagramId) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.dataTransfer.dropEffect = 'move';
                                    setDragOverFolderId(null);
                                }
                            }}
                            onDrop={(e) => {
                                if (draggedDiagramId) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDrop(e, null);
                                }
                            }}
                        >
                            {folders.length === 0 && rootDiagrams.length === 0 ? (
                                <div className="text-center py-12 text-[var(--color-text-tertiary)] text-sm">
                                    No diagrams yet
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {/* Folders */}
                                    {folders.length > 0 && (
                                        <div className="space-y-1">
                                            {folders.map((folder) => {
                                                const folderId = String(folder.id || '');
                                                if (!folderId) return null;
                                                const folderDiagrams = getDiagramsInFolder(folderId);
                                                const isExpanded = expandedFolders.has(folderId);
                                                return (
                                                    <div key={folderId} className="space-y-1">
                                                        <div
                                                            onDragOver={(e) => handleDragOver(e, folderId)}
                                                            onDragLeave={handleDragLeave}
                                                            onDrop={(e) => handleDrop(e, folderId)}
                                                            className={`flex items-center gap-1 group rounded transition-colors ${dragOverFolderId === folderId && draggedDiagramId
                                                                ? 'bg-primary-500/20 border-2 border-primary-500'
                                                                : ''
                                                                }`}
                                                        >
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleFolder(folderId);
                                                                }}
                                                                className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-[var(--color-hover)] transition-colors text-left"
                                                            >
                                                                <Icon name={isExpanded ? "FolderOpen" : "Folder"} className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                                                                <span className="text-xs text-[var(--color-text-primary)] truncate">{folder.name}</span>
                                                                <span className="text-[10px] text-[var(--color-text-tertiary)] ml-auto">
                                                                    ({folderDiagrams.length})
                                                                </span>
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteFolder(folderId);
                                                                }}
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-xs text-[var(--color-text-tertiary)] hover:text-red-500"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                        {isExpanded && (
                                                            <div className="ml-4 space-y-0.5">
                                                                {folderDiagrams.length === 0 ? (
                                                                    <div className="px-2 py-1 text-[10px] text-[var(--color-text-tertiary)] italic">
                                                                        Empty folder
                                                                    </div>
                                                                ) : (
                                                                    folderDiagrams.map((diagram) => (
                                                                        <div
                                                                            key={diagram.id}
                                                                            draggable
                                                                            onDragStart={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDragStart(e, diagram.id);
                                                                            }}
                                                                            onDragEnd={() => {
                                                                                setDraggedDiagramId(null);
                                                                                setDragOverFolderId(null);
                                                                            }}
                                                                            className={`px-2 py-1.5 rounded cursor-pointer transition-all duration-150 group ${selectedDiagram === diagram.id
                                                                                ? 'bg-[var(--color-primary)] text-white'
                                                                                : 'bg-[var(--color-background)] hover:bg-[var(--color-hover)] text-[var(--color-text-primary)]'
                                                                                } ${draggedDiagramId === diagram.id ? 'opacity-50' : ''}`}
                                                                            onClick={() => handleSelectDiagram(diagram.id)}
                                                                        >
                                                                            <div className="flex items-start justify-between">
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className={`text-xs font-medium truncate ${selectedDiagram === diagram.id ? 'text-white' : 'text-[var(--color-text-primary)]'
                                                                                        }`}>
                                                                                        {diagram.name}
                                                                                    </div>
                                                                                    <div className={`text-[10px] mt-0.5 ${selectedDiagram === diagram.id ? 'text-white/80' : 'text-[var(--color-text-secondary)]'
                                                                                        }`}>
                                                                                        {new Date(diagram.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                                    </div>
                                                                                </div>
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleDeleteDiagram(diagram.id);
                                                                                    }}
                                                                                    className={`opacity-0 group-hover:opacity-100 transition-opacity ml-1.5 text-xs ${selectedDiagram === diagram.id
                                                                                        ? 'text-white hover:text-red-200'
                                                                                        : 'text-[var(--color-text-tertiary)] hover:text-red-500'
                                                                                        }`}
                                                                                >
                                                                                    ×
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Root Diagrams - grouped by date */}
                                    {rootDiagramsGrouped.length > 0 && (
                                        <div className="space-y-2">
                                            {rootDiagramsGrouped.map((group) => (
                                                <div key={group.label} className="space-y-1">
                                                    <button
                                                        onClick={() => toggleGroup(group.label)}
                                                        className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider hover:text-[var(--color-text-primary)] transition-colors"
                                                    >
                                                        <span>{group.label}</span>
                                                        <span className="text-[var(--color-text-tertiary)] text-[9px]">
                                                            {expandedGroups.has(group.label) ? '−' : '+'}
                                                        </span>
                                                    </button>
                                                    {expandedGroups.has(group.label) && (
                                                        <div className="space-y-0.5">
                                                            {group.items.map((diagram) => (
                                                                <div
                                                                    key={diagram.id}
                                                                    draggable
                                                                    onDragStart={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDragStart(e, diagram.id);
                                                                    }}
                                                                    onDragEnd={() => {
                                                                        setDraggedDiagramId(null);
                                                                        setDragOverFolderId(null);
                                                                    }}
                                                                    className={`px-2 py-1.5 rounded cursor-pointer transition-all duration-150 group ${selectedDiagram === diagram.id
                                                                        ? 'bg-[var(--color-primary)] text-white'
                                                                        : 'bg-[var(--color-background)] hover:bg-[var(--color-hover)] text-[var(--color-text-primary)]'
                                                                        } ${draggedDiagramId === diagram.id ? 'opacity-50' : ''}`}
                                                                    onClick={() => handleSelectDiagram(diagram.id)}
                                                                >
                                                                    <div className="flex items-start justify-between">
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className={`text-xs font-medium truncate ${selectedDiagram === diagram.id ? 'text-white' : 'text-[var(--color-text-primary)]'
                                                                                }`}>
                                                                                {diagram.name}
                                                                            </div>
                                                                            <div className={`text-[10px] mt-0.5 ${selectedDiagram === diagram.id ? 'text-white/80' : 'text-[var(--color-text-secondary)]'
                                                                                }`}>
                                                                                {new Date(diagram.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDeleteDiagram(diagram.id);
                                                                            }}
                                                                            className={`opacity-0 group-hover:opacity-100 transition-opacity ml-1.5 text-xs ${selectedDiagram === diagram.id
                                                                                ? 'text-white hover:text-red-200'
                                                                                : 'text-[var(--color-text-tertiary)] hover:text-red-500'
                                                                                }`}
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* New Folder Input */}
                                    {showNewFolderInput ? (
                                        <div className="px-2 py-1 space-y-1">
                                            <input
                                                type="text"
                                                value={newFolderName}
                                                onChange={(e) => setNewFolderName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleCreateFolder();
                                                    } else if (e.key === 'Escape') {
                                                        setShowNewFolderInput(false);
                                                        setNewFolderName('');
                                                    }
                                                }}
                                                placeholder="Folder name..."
                                                className="w-full px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)]"
                                                autoFocus
                                            />
                                            <div className="flex gap-1">
                                                <button onClick={handleCreateFolder} className="px-2 py-1 text-xs rounded bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity flex-1">
                                                    Create
                                                </button>
                                                <button onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }} className="px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] hover:bg-[var(--color-muted)] transition-colors flex-1">
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowNewFolderInput(true)}
                                            className="w-full px-2 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] rounded transition-colors flex items-center gap-1.5"
                                        >
                                            <Icon name="Plus" className="w-3 h-3" />
                                            New Folder
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                <div ref={containerRef} className="flex-1 flex overflow-hidden relative" style={{ minHeight: 0 }}>
                    {/* Code Editor */}
                    <div
                        className="flex flex-col border-r border-[var(--color-border)] bg-[var(--color-background)]"
                        style={{
                            minHeight: 0,
                            width: `${splitPosition}%`,
                            flexShrink: 0
                        }}
                    >
                        <div className="flex-shrink-0 px-4 py-1.5 bg-[var(--color-sidebar)] border-b border-[var(--color-border)]">
                            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Mermaid Code</span>
                        </div>
                        <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
                            <Editor
                                height="100%"
                                defaultLanguage="mermaid"
                                value={code}
                                onChange={(value) => setCode(value || '')}
                                theme={document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light'}
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 14,
                                    wordWrap: 'on',
                                    padding: { top: 16, bottom: 16 },
                                    automaticLayout: true,
                                    lineNumbers: 'on',
                                    scrollBeyondLastLine: false,
                                    fontFamily: "'Fira Code', 'Monaco', 'Courier New', monospace",
                                    fontLigatures: true,
                                    tabSize: 2,
                                    insertSpaces: true,
                                    renderWhitespace: 'selection',
                                    cursorBlinking: 'smooth',
                                    smoothScrolling: true,
                                }}
                            />
                        </div>
                    </div>

                    {/* Resize Handle */}
                    <div
                        onMouseDown={handleMouseDown}
                        className={`w-1 bg-[var(--color-border)] hover:bg-[var(--color-primary)] cursor-col-resize flex-shrink-0 transition-colors ${isDragging ? 'bg-[var(--color-primary)]' : ''
                            }`}
                        style={{ minWidth: '4px' }}
                    />

                    {/* Diagram Preview */}
                    <div
                        className="flex flex-col overflow-hidden bg-[var(--color-background)]"
                        style={{
                            minHeight: 0,
                            width: `${100 - splitPosition}%`,
                            flexShrink: 0
                        }}
                    >
                        <div className="flex-shrink-0 px-4 py-1.5 bg-[var(--color-sidebar)] border-b border-[var(--color-border)] flex items-center justify-between">
                            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Preview</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={exportToImage}
                                    className="px-2 py-1 rounded text-xs border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] hover:bg-[var(--color-muted)] transition-colors"
                                    title="Export as High-Resolution PNG"
                                >
                                    📥 Export
                                </button>
                                <button
                                    onClick={handleZoomOut}
                                    className="px-2 py-1 rounded text-xs border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] hover:bg-[var(--color-muted)] transition-colors"
                                    title="Zoom Out"
                                >
                                    −
                                </button>
                                <span className="px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] min-w-[50px] text-center">
                                    {zoom}%
                                </span>
                                <button
                                    onClick={handleZoomIn}
                                    className="px-2 py-1 rounded text-xs border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] hover:bg-[var(--color-muted)] transition-colors"
                                    title="Zoom In"
                                >
                                    +
                                </button>
                                <button
                                    onClick={handleZoomReset}
                                    className="px-2 py-1 rounded text-xs border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] hover:bg-[var(--color-muted)] transition-colors ml-1"
                                    title="Reset Zoom"
                                >
                                    ↻
                                </button>
                            </div>
                        </div>
                        <div
                            className="flex-1 overflow-auto p-4 bg-[var(--color-background)]"
                            style={{ minHeight: 0 }}
                            onWheel={handleWheel}
                        >
                            {error && (
                                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
                                    <div className="font-medium mb-1">Error rendering diagram:</div>
                                    <div className="font-mono text-xs break-words">{error}</div>
                                </div>
                            )}
                            {!mermaidInitialized && !error && (
                                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm text-blue-700 dark:text-blue-400">
                                    Initializing Mermaid renderer...
                                </div>
                            )}
                            <div
                                ref={diagramRef}
                                className="flex items-center justify-center min-h-full"
                                style={{
                                    minHeight: '400px',
                                    transform: `scale(${zoom / 100})`,
                                    transformOrigin: 'center top',
                                    transition: isDragging ? 'none' : 'transform 0.2s ease'
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}

