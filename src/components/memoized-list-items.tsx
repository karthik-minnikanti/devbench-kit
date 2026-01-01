import React, { memo } from 'react';
import { Icon } from './Icon';

interface NoteItemProps {
    note: {
        id: string;
        title: string;
        updatedAt: string;
    };
    isSelected: boolean;
    isDragged: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onDragStart: (e: React.DragEvent, id: string) => void;
    onDragEnd: () => void;
}

export const NoteItem = memo<NoteItemProps>(({
    note,
    isSelected,
    isDragged,
    onSelect,
    onDelete,
    onDragStart,
    onDragEnd
}) => {
    // Guard against undefined note
    if (!note) {
        return null;
    }
    
    return (
        <div
            draggable
            onDragStart={(e) => {
                e.stopPropagation();
                onDragStart(e, note.id);
            }}
            onDragEnd={onDragEnd}
            className={`px-2 py-1.5 rounded cursor-pointer transition-all duration-150 group ${isSelected
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-card)] hover:bg-[var(--color-muted)] text-[var(--color-text-primary)]'
                } ${isDragged ? 'opacity-50' : ''}`}
            onClick={() => onSelect(note.id)}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium truncate ${isSelected ? 'text-white' : 'text-[var(--color-text-primary)]'
                        }`}>
                        {note.title || 'Untitled Note'}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-white/80' : 'text-[var(--color-text-tertiary)]'
                        }`}>
                        {note.updatedAt ? new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(note.id);
                    }}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity ml-1.5 text-xs ${isSelected
                            ? 'text-white hover:text-red-200'
                            : 'text-[var(--color-text-tertiary)] hover:text-red-500'
                        }`}
                >
                    <Icon name="Trash2" className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison function for better performance
    return (
        prevProps.note.id === nextProps.note.id &&
        prevProps.note.title === nextProps.note.title &&
        prevProps.note.updatedAt === nextProps.note.updatedAt &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.isDragged === nextProps.isDragged
    );
});

NoteItem.displayName = 'NoteItem';

interface DrawingItemProps {
    drawing: {
        id: string;
        title: string;
        updatedAt: string;
    };
    isSelected: boolean;
    isDragged: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onDragStart: (e: React.DragEvent, id: string) => void;
    onDragEnd: () => void;
}

export const DrawingItem = memo<DrawingItemProps>(({
    drawing,
    isSelected,
    isDragged,
    onSelect,
    onDelete,
    onDragStart,
    onDragEnd
}) => {
    return (
        <div
            draggable
            onDragStart={(e) => {
                e.stopPropagation();
                onDragStart(e, drawing.id);
            }}
            onDragEnd={onDragEnd}
            className={`px-2 py-1.5 rounded cursor-pointer transition-all duration-150 group ${isSelected
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-card)] hover:bg-[var(--color-muted)] text-[var(--color-text-primary)]'
                } ${isDragged ? 'opacity-50' : ''}`}
            onClick={() => onSelect(drawing.id)}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium truncate ${isSelected ? 'text-white' : 'text-[var(--color-text-primary)]'
                        }`}>
                        {drawing.title}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-white/80' : 'text-[var(--color-text-tertiary)]'
                        }`}>
                        {new Date(drawing.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(drawing.id);
                    }}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity ml-1.5 text-xs ${isSelected
                            ? 'text-white hover:text-red-200'
                            : 'text-[var(--color-text-tertiary)] hover:text-red-500'
                        }`}
                >
                    <Icon name="Trash2" className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison function for better performance
    return (
        prevProps.drawing.id === nextProps.drawing.id &&
        prevProps.drawing.title === nextProps.drawing.title &&
        prevProps.drawing.updatedAt === nextProps.drawing.updatedAt &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.isDragged === nextProps.isDragged
    );
});

DrawingItem.displayName = 'DrawingItem';






