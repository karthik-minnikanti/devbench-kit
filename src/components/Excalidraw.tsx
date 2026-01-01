import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';

// Type definitions for Excalidraw
type ExcalidrawImperativeAPI = any;
type BinaryFiles = any;
type ExcalidrawElement = any;
import { groupByDate, DateGroup } from '../utils/dateGrouping';
import { getDrawings, getDrawing, saveDrawing, deleteDrawing, Drawing as DrawingType, getFolders, saveFolder, deleteFolder, Folder } from '../services/sync';
import { Icon } from './Icon';
import { hasDrawingChanged } from '../utils/sync';
import { DrawingItem } from './memoized-list-items';

interface Drawing {
    id: string;
    title: string;
    elements?: readonly ExcalidrawElement[];
    files?: BinaryFiles;
    folderId?: string | null;
    createdAt: string;
    updatedAt: string;
}

export function ExcalidrawComponent() {
    const [drawings, setDrawings] = useState<Drawing[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [selectedDrawing, setSelectedDrawing] = useState<string | null>(null);
    const [drawingTitle, setDrawingTitle] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [dateGroups, setDateGroups] = useState<DateGroup[]>([]);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Today', 'Yesterday', 'This Week']));
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [showSidebar, setShowSidebar] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [draggedDrawingId, setDraggedDrawingId] = useState<string | null>(null);
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
    const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
    const titleChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSyncedStateRef = useRef<Map<string, { title: string; elements: any[]; files: any; folderId?: string | null }>>(new Map());
    const handleSaveDrawingRef = useRef<((titleToSave?: string) => Promise<void>) | null>(null);
    const selectedDrawingRef = useRef<string | null>(null);
    const isLoadingContentRef = useRef<boolean>(false);
    const latestFilesRef = useRef<BinaryFiles>({});

    // Helper function to deep clone elements and files for storage in lastSyncedStateRef
    // This prevents mutation issues where Excalidraw mutates objects in place
    const cloneForSync = (elements: any, files: any) => {
        return {
            elements: elements ? JSON.parse(JSON.stringify(elements)) : [],
            files: files ? JSON.parse(JSON.stringify(files)) : {}
        };
    };

    useEffect(() => {
        loadDrawings();
        loadFolders();
    }, []);

    // Check for pending item ID from Home component
    useEffect(() => {
        const pendingItem = (window as any).__pendingItemId;
        if (pendingItem && pendingItem.toolType === 'excalidraw' && pendingItem.itemId) {
            // Wait a bit for drawings to load
            setTimeout(() => {
                const drawingId = pendingItem.itemId;
                const normalizedDrawingId = String(drawingId || '');
                const drawing = drawings.find(d => String(d.id || '') === normalizedDrawingId);
                if (drawing && drawing.id) {
                    handleSelectDrawing(drawing.id);
                }
                delete (window as any).__pendingItemId;
            }, 500);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [drawings]);

    // Helper function to normalize drawing IDs (handle MongoDB _id)
    const normalizeDrawingId = (drawing: any): string => {
        const id = drawing.id || drawing._id;
        return id ? String(id) : '';
    };

    const loadDrawings = async () => {
        try {
            // Load drawings without content (elements and files) for better performance
            const loadedDrawings = await getDrawings(undefined, undefined, false);
            // Drawings are already normalized by getDrawings
            // Transform MongoDB format to component format
            // Normalize folderId: convert undefined/null to null for consistency
            const transformedDrawings = loadedDrawings
                .map(drawing => {
                    const normalizedId = normalizeDrawingId(drawing);
                    return {
                        ...drawing,
                        id: normalizedId,
                        folderId: (drawing.folderId === undefined || drawing.folderId === null) ? null : drawing.folderId,
                    };
                })
                .filter(drawing => drawing.id) // Filter out drawings without valid IDs
                .map(drawing => ({
                    ...drawing,
                    createdAt: drawing.createdAt || new Date().toISOString(),
                    updatedAt: drawing.updatedAt || new Date().toISOString(),
                }));
            
            setDrawings(transformedDrawings);
            const grouped = groupByDate(transformedDrawings);
            setDateGroups(grouped);
            
            // Update last synced state only for drawings that have content
            transformedDrawings.forEach(drawing => {
                if (drawing.id && drawing.elements !== undefined && drawing.files !== undefined) {
                    lastSyncedStateRef.current.set(drawing.id, {
                        title: drawing.title,
                        elements: drawing.elements,
                        files: drawing.files,
                        folderId: drawing.folderId
                    });
                }
            });
        } catch (err) {
            console.error('Failed to load drawings:', err);
        }
    };

    const loadFolders = async () => {
        try {
            // Only load root-level folders (parentId = null)
            const loadedFolders = await getFolders(null);
            // Folders are already normalized by getFolders
            // Sort folders by createdAt descending (newest first)
            loadedFolders.sort((a, b) => {
                const dateA = new Date(a.createdAt || 0).getTime();
                const dateB = new Date(b.createdAt || 0).getTime();
                return dateB - dateA; // Descending order (newest first)
            });
            setFolders(loadedFolders);
            console.log('Loaded folders:', loadedFolders.length, loadedFolders);
        } catch (err) {
            console.error('Failed to load folders:', err);
        }
    };

    const handleCreateFolder = useCallback(async () => {
        if (!newFolderName.trim()) return;
        setLoading(true);
        try {
            const newFolder = await saveFolder({
                name: newFolderName.trim(),
                parentId: null, // Always root level
            });
            if (newFolder) {
                setNewFolderName('');
                setShowNewFolderInput(false);
                await loadFolders();
            }
        } catch (err) {
            console.error('Failed to create folder:', err);
        } finally {
            setLoading(false);
        }
    }, [newFolderName]);

    const handleDeleteFolder = useCallback(async (folderId: string | undefined) => {
        if (!folderId) {
            console.error('Cannot delete folder: folderId is undefined');
            return;
        }
        if (!confirm('Delete this folder? Items inside will be moved to root.')) return;
        try {
            const success = await deleteFolder(folderId);
            if (success) {
                // Move drawings in this folder to root
                const normalizedFolderId = String(folderId || '');
                const drawingsInFolder = drawings.filter(d => String(d.folderId || '') === normalizedFolderId);
                for (const drawing of drawingsInFolder) {
                    await saveDrawing({ ...drawing, folderId: null } as DrawingType);
                }
                await loadFolders();
                await loadDrawings();
            }
        } catch (err) {
            console.error('Failed to delete folder:', err);
        }
    }, [drawings]);

    const handleDragStart = useCallback((e: React.DragEvent, drawingId: string) => {
        e.stopPropagation(); // Prevent event from bubbling
        setDraggedDrawingId(drawingId);
        e.dataTransfer.effectAllowed = 'move';
        // Use a custom data type to prevent Excalidraw from picking it up
        e.dataTransfer.setData('application/x-drawing-id', drawingId);
        // Clear text/plain to prevent editor from inserting it
        e.dataTransfer.setData('text/plain', '');
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, folderId: string | null) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setDragOverFolderId(folderId);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        // Only clear if we're actually leaving the drop zone
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            setDragOverFolderId(null);
        }
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent, targetFolderId: string | null) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent event from bubbling to Excalidraw canvas
        setDragOverFolderId(null);
        
        // Get drawing ID from custom data type or state
        const drawingId = e.dataTransfer.getData('application/x-drawing-id') || draggedDrawingId;
        if (!drawingId) {
            setDraggedDrawingId(null);
            return;
        }

        const normalizedDrawingId = String(drawingId || '');
        const normalizedTargetFolderId = targetFolderId ? String(targetFolderId) : null;
        const drawing = drawings.find(d => String(d.id || '') === normalizedDrawingId);
        if (!drawing) {
            setDraggedDrawingId(null);
            return;
        }
        // Compare folderIds (normalize null/undefined)
        const drawingFolderId = drawing.folderId === null || drawing.folderId === undefined ? null : String(drawing.folderId);
        if (drawingFolderId === normalizedTargetFolderId) {
            setDraggedDrawingId(null);
            return;
        }

        try {
            const updatedDrawing = await saveDrawing({
                ...drawing,
                folderId: targetFolderId,
            } as DrawingType);
            await loadDrawings();
            
            // Update last synced state after successful sync (folderId change always needs sync)
            if (updatedDrawing && updatedDrawing.id) {
                lastSyncedStateRef.current.set(updatedDrawing.id, {
                    title: drawing.title,
                    elements: drawing.elements ? [...drawing.elements] : [],
                    files: drawing.files,
                    folderId: targetFolderId
                });
            }
            
            // Auto-expand folder when item is dropped into it
            if (targetFolderId) {
                setExpandedFolders(prev => new Set(prev).add(targetFolderId));
            }
        } catch (err) {
            console.error('Failed to move drawing:', err);
        } finally {
            setDraggedDrawingId(null);
        }
    }, [drawings, draggedDrawingId]);

    const toggleFolder = useCallback((folderId: string) => {
        const normalizedId = String(folderId || ''); // Ensure it's a string
        if (!normalizedId) {
            console.error('Cannot toggle folder: folderId is undefined or empty');
            return;
        }
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(normalizedId)) {
                newSet.delete(normalizedId);
            } else {
                newSet.add(normalizedId);
            }
            return newSet;
        });
    }, []);

    const getDrawingsInFolder = useCallback((folderId: string | null) => {
        // Normalize undefined to null for comparison
        // Items belong to a folder if folderId matches exactly
        // Items belong to root if folderId is null or undefined
        if (folderId === null) {
            return drawings.filter(drawing => drawing.folderId === null || drawing.folderId === undefined);
        } else {
            const normalizedFolderId = String(folderId || '');
            return drawings.filter(drawing => String(drawing.folderId || '') === normalizedFolderId);
        }
    }, [drawings]);

    const getFolderDrawingsGrouped = useCallback((folderId: string) => {
        const folderDrawings = getDrawingsInFolder(folderId);
        return groupByDate(folderDrawings);
    }, [getDrawingsInFolder]);


    const toggleGroup = useCallback((label: string) => {
        setExpandedGroups((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(label)) {
                newSet.delete(label);
            } else {
                newSet.add(label);
            }
            return newSet;
        });
    }, []);

    const handleCreateDrawing = useCallback(async () => {
        setLoading(true);
        try {
            // Generate a unique ID using timestamp + random to avoid collisions
            const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            // Generate a unique title with timestamp to avoid duplicates
            const timestamp = new Date().toLocaleString();
            const newDrawing = await saveDrawing({
                id: uniqueId,
                title: `Untitled Drawing ${timestamp}`,
                elements: [],
                files: {},
                folderId: null, // Create in root
            } as DrawingType);
            if (newDrawing && newDrawing.id) {
                const normalizedId = String(newDrawing.id);
                
                // Add the new drawing to state immediately without reloading all drawings
                setDrawings(prevDrawings => {
                    // Check if drawing already exists to avoid duplicates
                    const exists = prevDrawings.find(d => String(d.id || '') === normalizedId);
                    if (exists) {
                        return prevDrawings;
                    }
                    return [...prevDrawings, {
                        ...newDrawing,
                        id: normalizedId,
                        elements: [],
                        files: {},
                        folderId: null,
                        createdAt: newDrawing.createdAt || new Date().toISOString(),
                        updatedAt: newDrawing.updatedAt || new Date().toISOString(),
                    }];
                });
                
                setSelectedDrawing(normalizedId);
                setDrawingTitle(newDrawing.title);
                selectedDrawingRef.current = normalizedId;
                latestFilesRef.current = {};
                
                // Clear the canvas
                if (excalidrawAPI) {
                    excalidrawAPI.updateScene({
                        elements: [],
                        appState: {},
                    });
                }
                
                // Update last synced state with the normalized ID
                lastSyncedStateRef.current.set(normalizedId, {
                    title: newDrawing.title,
                    elements: [],
                    files: {},
                    folderId: null
                });
                
                // Reload drawings list to update date groups (but don't wait for it)
                loadDrawings().catch(err => console.error('Failed to reload drawings:', err));
            }
        } catch (err) {
            console.error('Failed to create drawing:', err);
        } finally {
            setLoading(false);
        }
    }, [excalidrawAPI]);

    // Don't auto-create drawings - let user create them explicitly

    const handleSelectDrawing = useCallback(async (drawingId: string) => {
        const normalizedDrawingId = String(drawingId || '');
        
        // Save current drawing before switching (if there's a selected drawing)
        if (selectedDrawing && selectedDrawing !== normalizedDrawingId && handleSaveDrawingRef.current) {
            console.log('[Excalidraw] Saving current drawing before switching:', selectedDrawing);
            // Clear any pending save timeout and save immediately
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
            }
            // Save immediately - don't await to make switching feel instant
            handleSaveDrawingRef.current().catch(err => {
                console.error('[Excalidraw] Error saving drawing before switch:', err);
            });
        }
        
        let drawing = drawings.find(d => String(d.id || '') === normalizedDrawingId);
        
        // If drawing doesn't have content, load it from API
        if (drawing && (drawing.elements === undefined || drawing.files === undefined)) {
            console.log('Loading drawing content for:', normalizedDrawingId);
            try {
                const fullDrawing = await getDrawing(normalizedDrawingId);
                if (fullDrawing) {
                    // Update the drawing in state with full content
                    setDrawings(prevDrawings => {
                        return prevDrawings.map(d => {
                            if (String(d.id || '') === normalizedDrawingId) {
                                return {
                                    ...d,
                                    elements: typeof fullDrawing.elements === 'string' ? JSON.parse(fullDrawing.elements || '[]') : (fullDrawing.elements || []),
                                    files: typeof fullDrawing.files === 'string' ? JSON.parse(fullDrawing.files || '{}') : (fullDrawing.files || {})
                                };
                            }
                            return d;
                        });
                    });
                    drawing = {
                        ...drawing,
                        elements: typeof fullDrawing.elements === 'string' ? JSON.parse(fullDrawing.elements || '[]') : (fullDrawing.elements || []),
                        files: typeof fullDrawing.files === 'string' ? JSON.parse(fullDrawing.files || '{}') : (fullDrawing.files || {})
                    };
                }
            } catch (err) {
                console.error('Failed to load drawing content:', err);
            }
        }
        
        if (drawing && drawing.id) {
            setSelectedDrawing(drawing.id);
            setDrawingTitle(drawing.title);
            selectedDrawingRef.current = drawing.id;
            // Reset latest files ref when switching drawings
            latestFilesRef.current = drawing.files || {};
            // Load drawing into Excalidraw
            if (excalidrawAPI && drawing.elements !== undefined) {
                excalidrawAPI.updateScene({
                    elements: drawing.elements as ExcalidrawElement[],
                    appState: {},
                });
                // Update files if available
                if (drawing.files && Object.keys(drawing.files).length > 0) {
                    excalidrawAPI.addFiles(Object.values(drawing.files));
                }
            }
        }
    }, [drawings, excalidrawAPI, selectedDrawing]);

    const handleSaveDrawing = async (titleToSave?: string) => {
        // Use ref to get current selectedDrawing (avoids stale closure issues)
        const currentSelectedDrawing = selectedDrawingRef.current;
        
        // Skip save if we're currently loading content
        if (isLoadingContentRef.current) {
            console.log('handleSaveDrawing: Skipping save - content is being loaded');
            return;
        }
        
        if (!currentSelectedDrawing || !excalidrawAPI) {
            console.warn('handleSaveDrawing: Missing requirements', { 
                selectedDrawing: currentSelectedDrawing, 
                hasAPI: !!excalidrawAPI 
            });
            return;
        }

        const normalizedSelectedId = String(currentSelectedDrawing || '');
        const drawing = drawings.find(d => String(d.id || '') === normalizedSelectedId);
        if (!drawing || !drawing.id) return;

        const elements = excalidrawAPI.getSceneElements();
        // Use files from onChange callback if available, otherwise get from API
        const files = Object.keys(latestFilesRef.current).length > 0 
            ? latestFilesRef.current 
            : excalidrawAPI.getFiles();
        // Use provided title or current state, ensuring we have the latest value
        const title = titleToSave !== undefined ? titleToSave : drawingTitle;
        
        // Use normalized ID for lookup to ensure consistency
        const normalizedDrawingId = String(drawing.id || '');
        
        // Check if anything actually changed
        const lastSynced = lastSyncedStateRef.current.get(normalizedDrawingId);
        if (lastSynced && !hasDrawingChanged(lastSynced, {
            title: title || 'Untitled Drawing',
            elements,
            files,
            folderId: drawing.folderId || null
        })) {
            // No changes detected, skip sync
            console.log('handleSaveDrawing: No changes detected, skipping sync', {
                drawingId: normalizedDrawingId,
                elementsCount: elements?.length,
                lastSyncedElementsCount: lastSynced?.elements?.length
            });
            return;
        }
        
        console.log('handleSaveDrawing: Changes detected, proceeding with save', {
            drawingId: normalizedDrawingId,
            elementsCount: elements?.length,
            hasLastSynced: !!lastSynced
        });

        try {
            // Preserve existing drawing data to prevent data loss
            const drawingToSave = {
                id: drawing.id,
                title: title || drawing.title || 'Untitled Drawing',
                elements: elements || drawing.elements || [],
                files: files || drawing.files || {},
                folderId: drawing.folderId !== undefined ? drawing.folderId : null,
                createdAt: drawing.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            
            const updatedDrawing = await saveDrawing(drawingToSave as DrawingType);
            if (updatedDrawing && updatedDrawing.id) {
                const normalizedId = String(updatedDrawing.id);
                
                // Update the drawing in state with the normalized ID
                setDrawings(prevDrawings => {
                    return prevDrawings.map(d => {
                        if (String(d.id || '') === normalizedSelectedId) {
                            // Preserve existing data if updatedDrawing is missing fields
                            const savedElements = updatedDrawing.elements !== undefined
                                ? (typeof updatedDrawing.elements === 'string' ? JSON.parse(updatedDrawing.elements || '[]') : (updatedDrawing.elements || []))
                                : (elements || d.elements || []);
                            const savedFiles = updatedDrawing.files !== undefined
                                ? (typeof updatedDrawing.files === 'string' ? JSON.parse(updatedDrawing.files || '{}') : (updatedDrawing.files || {}))
                                : (files || d.files || {});
                            
                            return {
                                ...d,
                                id: normalizedId,
                                title: updatedDrawing.title || d.title || 'Untitled Drawing',
                                elements: savedElements,
                                files: savedFiles,
                                folderId: updatedDrawing.folderId !== undefined ? updatedDrawing.folderId : (d.folderId !== undefined ? d.folderId : null),
                                createdAt: updatedDrawing.createdAt || d.createdAt || new Date().toISOString(),
                                updatedAt: updatedDrawing.updatedAt || new Date().toISOString(),
                            };
                        }
                        return d;
                    });
                });
                
                // Update selectedDrawing if it changed
                if (normalizedId !== normalizedSelectedId) {
                    setSelectedDrawing(normalizedId);
                    // Remove old ID from lastSyncedStateRef when ID changes
                    lastSyncedStateRef.current.delete(normalizedSelectedId);
                }
                
                // Update last synced state after successful sync
                // IMPORTANT: Deep clone elements and files to prevent mutation issues
                // Excalidraw elements are mutable objects, so storing references causes false "no change" detection
                const { elements: clonedElements, files: clonedFiles } = cloneForSync(elements, files);
                lastSyncedStateRef.current.set(normalizedId, {
                    title: title || 'Untitled Drawing',
                    elements: clonedElements,
                    files: clonedFiles,
                    folderId: drawing.folderId || null
                });
                console.log('handleSaveDrawing: Updated lastSyncedStateRef', {
                    normalizedId,
                    elementsCount: clonedElements?.length,
                    filesCount: Object.keys(clonedFiles || {}).length
                });
            }
        } catch (err) {
            console.error('Failed to save drawing:', err);
        }
    };

    const handleDeleteDrawing = useCallback(async (drawingId: string) => {
        if (!confirm('Delete this drawing?')) return;

        try {
            const normalizedDrawingId = String(drawingId || '');
            const success = await deleteDrawing(normalizedDrawingId);
            if (success) {
                if (String(selectedDrawing || '') === normalizedDrawingId) {
                    setSelectedDrawing(null);
                    setDrawingTitle('');
                    selectedDrawingRef.current = null;
                    if (excalidrawAPI) {
                        excalidrawAPI.updateScene({
                            elements: [],
                            appState: {},
                        });
                    }
                }
                await loadDrawings();
                // Remove from last synced state
                lastSyncedStateRef.current.delete(normalizedDrawingId);
            }
        } catch (err) {
            console.error('Failed to delete drawing:', err);
        }
    }, [selectedDrawing, excalidrawAPI]);

    const handleTitleChange = useCallback(async (newTitle: string) => {
        setDrawingTitle(newTitle);
        // Clear previous timeout
        if (titleChangeTimeoutRef.current) {
            clearTimeout(titleChangeTimeoutRef.current);
        }
        // Auto-save on title change with the new title value passed directly
        if (selectedDrawing) {
            titleChangeTimeoutRef.current = setTimeout(() => {
                handleSaveDrawing(newTitle); // Pass the title directly to ensure latest value
            }, 500);
        }
    }, [selectedDrawing]);

    // Memoize root drawings and grouped drawings
    const rootDrawings = useMemo(() => getDrawingsInFolder(null), [getDrawingsInFolder]);
    const rootDrawingsGrouped = useMemo(() => groupByDate(rootDrawings), [rootDrawings]);

    // Store the latest handleSaveDrawing function in a ref
    useEffect(() => {
        handleSaveDrawingRef.current = handleSaveDrawing;
    }, [selectedDrawing, excalidrawAPI, drawingTitle, drawings]);

    // Auto-save on Excalidraw changes (immediate)
    useEffect(() => {
        if (!selectedDrawing || !excalidrawAPI) return;

        // Clear any existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Save immediately with minimal debounce to batch rapid changes
        saveTimeoutRef.current = setTimeout(() => {
            if (handleSaveDrawingRef.current) {
                handleSaveDrawingRef.current();
            }
        }, 200); // 200ms debounce for immediate feel

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [selectedDrawing, excalidrawAPI]);

    return (
        <div className="h-full flex flex-col bg-[var(--color-background)]">
            <div className="px-4 py-2 border-b border-[var(--color-border)] flex-shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSidebar(!showSidebar)}
                        className="px-2 py-1 rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] text-xs transition-colors"
                    >
                        {showSidebar ? '←' : '→'}
                    </button>
                    <div className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
                        Drawings
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {selectedDrawing && (
                        <button
                            onClick={() => handleSaveDrawing()}
                            className="px-2.5 py-1 rounded bg-[var(--color-primary)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
                        >
                            Save
                        </button>
                    )}
                    <button
                        onClick={handleCreateDrawing}
                        disabled={loading}
                        className="px-2.5 py-1 rounded bg-[var(--color-primary)] text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        + New
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Drawings List - Collapsible */}
                {showSidebar && (
                    <div className="w-56 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-sidebar)] overflow-y-auto custom-scrollbar flex flex-col">
                        <div 
                            className="p-2 flex-1"
                            onDragOver={(e) => {
                                if (draggedDrawingId) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.dataTransfer.dropEffect = 'move';
                                    setDragOverFolderId(null);
                                }
                            }}
                            onDrop={(e) => {
                                if (draggedDrawingId) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDrop(e, null);
                                }
                            }}
                        >
                            {/* Folders (sorted by createdAt) and Root Drawings (grouped by date) */}
                            {(() => {
                                if (folders.length === 0 && rootDrawings.length === 0) {
                                    return (
                                        <div className="text-center py-12 text-[var(--color-text-tertiary)] text-sm">
                                            No drawings yet
                                        </div>
                                    );
                                }
                                
                                return (
                                    <div className="space-y-2">
                                        {/* Folders - sorted by createdAt (newest first) */}
                                        {folders.length > 0 && (
                                            <div className="space-y-1">
                                                {folders.map((folder) => {
                                                    const folderId = String(folder.id || (folder as any)._id || ''); // Ensure it's a string
                                                    if (!folderId) return null; // Skip if no ID
                                                    const folderDrawings = getDrawingsInFolder(folderId); // Only drawings in THIS folder
                                                    const isExpanded = expandedFolders.has(folderId);
                                                    return (
                                                        <div key={folderId} className="space-y-1">
                                                            <div
                                                                onDragOver={(e) => handleDragOver(e, folderId)}
                                                                onDragLeave={handleDragLeave}
                                                                onDrop={(e) => handleDrop(e, folderId)}
                                                                className={`flex items-center gap-1 group rounded transition-colors ${
                                                                    dragOverFolderId === folderId && draggedDrawingId
                                                                        ? 'bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)]'
                                                                        : ''
                                                                }`}
                                                            >
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleFolder(folderId);
                                                                    }}
                                                                    className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-[var(--color-muted)] transition-colors text-left"
                                                                >
                                                                    <Icon 
                                                                        name={isExpanded ? "FolderOpen" : "Folder"} 
                                                                        className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" 
                                                                    />
                                                                    <span className="text-xs text-[var(--color-text-primary)] truncate">{folder.name}</span>
                                                                    <span className="text-[10px] text-[var(--color-text-tertiary)] ml-auto">
                                                                        ({folderDrawings.length})
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
                                                            {/* Folder contents when expanded - only items in THIS folder */}
                                                            {isExpanded && (
                                                                <div className="ml-4 space-y-0.5">
                                                                    {folderDrawings.length === 0 ? (
                                                                        <div className="px-2 py-1 text-[10px] text-[var(--color-text-tertiary)] italic">
                                                                            Empty folder
                                                                        </div>
                                                                    ) : (
                                                                        folderDrawings.map((drawing) => (
                                                                            <div
                                                                                key={drawing.id}
                                                                                draggable
                                                                                onDragStart={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDragStart(e, drawing.id);
                                                                                }}
                                                                                onDragEnd={() => {
                                                                                    setDraggedDrawingId(null);
                                                                                    setDragOverFolderId(null);
                                                                                }}
                                                                                className={`px-2 py-1.5 rounded cursor-pointer transition-all duration-150 group ${String(selectedDrawing || '') === String(drawing.id || '')
                                                                                    ? 'bg-[var(--color-primary)] text-white'
                                                                                    : 'bg-[var(--color-card)] hover:bg-[var(--color-muted)] text-[var(--color-text-primary)]'
                                                                                    } ${String(draggedDrawingId || '') === String(drawing.id || '') ? 'opacity-50' : ''}`}
                                                                                onClick={() => handleSelectDrawing(drawing.id)}
                                                                            >
                                                                                <div className="flex items-start justify-between">
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <div className={`text-xs font-medium truncate ${String(selectedDrawing || '') === String(drawing.id || '')
                                                                                            ? 'text-white'
                                                                                            : 'text-[var(--color-text-primary)]'
                                                                                            }`}>
                                                                                            {drawing.title}
                                                                                        </div>
                                                                                        <div className={`text-[10px] mt-0.5 ${String(selectedDrawing || '') === String(drawing.id || '')
                                                                                            ? 'text-white/80'
                                                                                            : 'text-[var(--color-text-tertiary)]'
                                                                                            }`}>
                                                                                            {new Date(drawing.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                                        </div>
                                                                                    </div>
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleDeleteDrawing(drawing.id);
                                                                                        }}
                                                                                        className={`opacity-0 group-hover:opacity-100 transition-opacity ml-1.5 text-xs ${String(selectedDrawing || '') === String(drawing.id || '')
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
                                        
                                        {/* Root Drawings - grouped by date */}
                                        {rootDrawingsGrouped.length > 0 && (
                                            <div className="space-y-2">
                                                {rootDrawingsGrouped.map((group) => (
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
                                                                {group.items.map((drawing) => (
                                                                    <div
                                                                        key={drawing.id}
                                                                        draggable
                                                                        onDragStart={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDragStart(e, drawing.id);
                                                                        }}
                                                                        onDragEnd={() => {
                                                                            setDraggedDrawingId(null);
                                                                            setDragOverFolderId(null);
                                                                        }}
                                                                        className={`px-2 py-1.5 rounded cursor-pointer transition-all duration-150 group ${String(selectedDrawing || '') === String(drawing.id || '')
                                                                            ? 'bg-[var(--color-primary)] text-white'
                                                                            : 'bg-[var(--color-card)] hover:bg-[var(--color-muted)] text-[var(--color-text-primary)]'
                                                                            } ${String(draggedDrawingId || '') === String(drawing.id || '') ? 'opacity-50' : ''}`}
                                                                        onClick={() => handleSelectDrawing(drawing.id)}
                                                                    >
                                                                        <div className="flex items-start justify-between">
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className={`text-xs font-medium truncate ${String(selectedDrawing || '') === String(drawing.id || '')
                                                                                    ? 'text-white'
                                                                                    : 'text-[var(--color-text-primary)]'
                                                                                    }`}>
                                                                                    {drawing.title}
                                                                                </div>
                                                                                <div className={`text-[10px] mt-0.5 ${String(selectedDrawing || '') === String(drawing.id || '')
                                                                                    ? 'text-white/80'
                                                                                    : 'text-[var(--color-text-tertiary)]'
                                                                                    }`}>
                                                                                    {new Date(drawing.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                                </div>
                                                                            </div>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDeleteDrawing(drawing.id);
                                                                                }}
                                                                                className={`opacity-0 group-hover:opacity-100 transition-opacity ml-1.5 text-xs ${String(selectedDrawing || '') === String(drawing.id || '')
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
                                    </div>
                                );
                            })()}
                        </div>
                        {/* New Folder Button - Fixed at bottom */}
                        <div className="p-2 border-t border-[var(--color-border)] bg-[var(--color-sidebar)] flex-shrink-0">
                            {showNewFolderInput ? (
                                <div className="flex items-center gap-1">
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
                                        placeholder="Folder name"
                                        className="flex-1 px-2 py-1 text-xs bg-[var(--color-card)] border border-[var(--color-border)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-[var(--color-text-primary)]"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleCreateFolder}
                                        className="px-2 py-1 text-xs bg-[var(--color-primary)] text-white rounded hover:opacity-90"
                                    >
                                        ✓
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowNewFolderInput(true)}
                                    className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-muted)] rounded transition-colors"
                                >
                                    <Icon name="Plus" className="w-3 h-3" />
                                    <span>New Folder</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Editor - Compact */}
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-background)]">
                    {selectedDrawing ? (
                        <>
                            <div className="px-4 py-2 border-b border-[var(--color-border)] flex-shrink-0">
                                <input
                                    type="text"
                                    value={drawingTitle}
                                    onChange={(e) => handleTitleChange(e.target.value)}
                                    placeholder="Untitled Drawing"
                                    className="w-full text-sm font-semibold text-[var(--color-text-primary)] bg-transparent border-none outline-none placeholder-[var(--color-text-tertiary)]"
                                />
                            </div>
                            <div className="flex-1 overflow-hidden" style={{ height: '100%', width: '100%', position: 'relative', minHeight: 0 }}>
                                <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
                                    <Excalidraw
                                        key={selectedDrawing}
                                        excalidrawAPI={(api: ExcalidrawImperativeAPI) => setExcalidrawAPI(api)}
                                        theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                                        initialData={{
                                            elements: drawings.find(d => String(d.id || '') === String(selectedDrawing || ''))?.elements || [],
                                            appState: {},
                                            files: drawings.find(d => String(d.id || '') === String(selectedDrawing || ''))?.files || {},
                                        }}
                                        onChange={(elements, appState, files) => {
                                            // Store latest files from onChange callback
                                            if (files) {
                                                latestFilesRef.current = files;
                                            }
                                            // Trigger immediate save when content changes
                                            // Files are included in the onChange callback, so we need to save them
                                            if (saveTimeoutRef.current) {
                                                clearTimeout(saveTimeoutRef.current);
                                            }
                                            saveTimeoutRef.current = setTimeout(() => {
                                                if (handleSaveDrawingRef.current) {
                                                    handleSaveDrawingRef.current();
                                                }
                                            }, 200); // 200ms debounce for immediate feel
                                        }}
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center bg-[var(--color-sidebar)]">
                            <div className="text-center">
                                <p className="text-[var(--color-text-secondary)] text-sm mb-4">
                                    {drawings.length === 0 ? 'No drawings yet' : 'Select a drawing or create a new one'}
                                </p>
                                <button
                                    onClick={handleCreateDrawing}
                                    disabled={loading}
                                    className="px-4 py-2 rounded bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    {loading ? 'Creating...' : '+ Create New Drawing'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

