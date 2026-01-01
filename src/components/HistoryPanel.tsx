import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { groupByDate, DateGroup } from '../utils/dateGrouping';

interface HistoryEntryWithDate {
    id: string;
    updatedAt: string;
    timestamp: string;
    type: 'schema' | 'js-snippet' | 'uml';
    jsonInput?: string;
    code?: string;
    umlCode?: string;
    schemaType?: 'typescript' | 'zod' | 'prisma' | 'mongoose';
    output: string;
}

export function HistoryPanel() {
    const history = useStore((state) => state.history);
    const loadHistory = useStore((state) => state.loadHistory);
    const setJsonInput = useStore((state) => state.setJsonInput);
    const setSelectedSchemaType = useStore((state) => state.setSelectedSchemaType);
    const [dateGroups, setDateGroups] = useState<DateGroup[]>([]);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Today', 'Yesterday', 'This Week']));

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    useEffect(() => {
        // Convert history entries to format expected by groupByDate
        const historyWithDate = history.map((entry) => ({
            ...entry,
            updatedAt: entry.timestamp,
        })) as HistoryEntryWithDate[];
        const grouped = groupByDate(historyWithDate);
        setDateGroups(grouped);
    }, [history]);

    const loadHistoryItem = (entry: typeof history[0]) => {
        if (entry.type === 'schema' && entry.jsonInput && entry.schemaType) {
            setJsonInput(entry.jsonInput);
            setSelectedSchemaType(entry.schemaType);
        }
    };

    const toggleGroup = (label: string) => {
        setExpandedGroups((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(label)) {
                newSet.delete(label);
            } else {
                newSet.add(label);
            }
            return newSet;
        });
    };

    return (
        <div className="h-full flex flex-col bg-white dark:bg-gray-900">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
                <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">History</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
                {history.length === 0 ? (
                    <div className="p-6 text-center">
                        <div className="text-gray-300 dark:text-gray-700 text-3xl mb-2">📝</div>
                        <p className="text-xs text-gray-400 dark:text-gray-500">No history yet</p>
                    </div>
                ) : (
                    <div className="p-2 space-y-2">
                        {dateGroups.map((group) => (
                            <div key={group.label} className="space-y-1">
                                <button
                                    onClick={() => toggleGroup(group.label)}
                                    className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                                >
                                    <span>{group.label}</span>
                                    <span className="text-gray-400 dark:text-gray-600 text-[9px]">
                                        {expandedGroups.has(group.label) ? '−' : '+'}
                                    </span>
                                </button>
                                {expandedGroups.has(group.label) && (
                                    <div className="space-y-0.5">
                                        {group.items.map((entry: any) => (
                                            <button
                                                key={entry.id}
                                                onClick={() => loadHistoryItem(entry)}
                                                className="w-full px-2 py-1.5 rounded text-left bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                                            >
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase">
                                                        {entry.type === 'schema'
                                                            ? entry.schemaType?.toUpperCase() || 'SCHEMA'
                                                            : entry.type === 'uml'
                                                                ? 'UML'
                                                                : 'JS'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-gray-600 dark:text-gray-400 truncate font-mono">
                                                    {entry.type === 'schema'
                                                        ? (entry.jsonInput?.substring(0, 40) || '') + '...'
                                                        : (entry.code?.substring(0, 40) || '') + '...'}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}


