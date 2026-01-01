import { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { getHistory } from '../services/history';
import { getNotes } from '../services/sync';
import { getDrawings } from '../services/sync';
import { getPlannerEntry } from '../services/sync';
import { BrandLogo } from './BrandLogo';
import { formatDateLocal } from '../utils/dateUtils';

interface RecentActivity {
    id: string;
    type: 'history' | 'note' | 'drawing' | 'planner';
    title: string;
    timestamp: Date;
    action?: () => void;
}

export function Home() {
    const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [todayTasks, setTodayTasks] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalHistory: 0,
        totalNotes: 0,
        totalDrawings: 0,
        completedTasks: 0,
        totalTasks: 0,
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load history (limit to 10 most recent from backend)
            const history = await getHistory(10);
            const historyItems: RecentActivity[] = history.map((entry: any) => ({
                id: entry.id || entry._id,
                type: 'history' as const,
                title: `${entry.type} - ${entry.output?.substring(0, 50) || 'No output'}...`,
                timestamp: new Date(entry.createdAt || entry.updatedAt || entry.timestamp),
            }));

            // Load notes (limit to 10 most recent from backend)
            const notes = await getNotes(10);
            const noteItems: RecentActivity[] = notes.map((note: any) => ({
                id: note.id || note._id,
                type: 'note' as const,
                title: note.title || 'Untitled Note',
                timestamp: new Date(note.updatedAt || note.createdAt),
            }));

            // Load drawings (limit to 10 most recent from backend)
            const drawings = await getDrawings(10);
            const drawingItems: RecentActivity[] = drawings.map((drawing: any) => ({
                id: drawing.id || drawing._id,
                type: 'drawing' as const,
                title: drawing.title || 'Untitled Drawing',
                timestamp: new Date(drawing.updatedAt || drawing.createdAt),
            }));

            // Load planner for today's date (using local timezone)
            const today = formatDateLocal();
            const plannerEntry = await getPlannerEntry(today);
            if (plannerEntry) {
                setTodayTasks(plannerEntry.tasks || []);
            } else {
                setTodayTasks([]);
            }

            // Combine and sort by timestamp (load all, filter by today in render, then limit to 10)
            const allActivities = [...historyItems, ...noteItems, ...drawingItems]
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

            setRecentActivities(allActivities);

            // Calculate stats (use today's planner for stats)
            const todayPlanner = plannerEntry;
            
            setStats({
                totalHistory: history.length,
                totalNotes: notes.length,
                totalDrawings: drawings.length,
                completedTasks: todayPlanner?.tasks?.filter((t: any) => t.completed).length || 0,
                totalTasks: todayPlanner?.tasks?.length || 0,
            });
        } catch (error) {
            console.error('Failed to load home data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatTimeAgo = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    // Allowed tools: api, planner, js-runner, notes, excalidraw, uml
    const ALLOWED_TOOLS = ['api', 'planner', 'js-runner', 'notes', 'excalidraw', 'uml'];
    
    const allQuickAccessItems = [
        { id: 'planner', label: 'Daily Planner', icon: 'Calendar', color: 'bg-pink-500' },
        { id: 'excalidraw', label: 'Excalidraw', icon: 'Pen', color: 'bg-purple-500' },
        { id: 'api', label: 'API Client', icon: 'Globe', color: 'bg-green-500' },
        { id: 'formatter', label: 'Formatter', icon: 'Code', color: 'bg-indigo-500' },
        { id: 'notes', label: 'Notes', icon: 'FileText', color: 'bg-yellow-500' },
        { id: 'schema', label: 'Schema Generator', icon: 'Schema', color: 'bg-blue-500' },
        { id: 'js-runner', label: 'JS Runner', icon: 'Zap', color: 'bg-orange-500' },
        { id: 'uml', label: 'UML Editor', icon: 'Chart', color: 'bg-cyan-500' },
    ];
    
    // Filter to only show allowed tools
    const quickAccessItems = allQuickAccessItems.filter(item => ALLOWED_TOOLS.includes(item.id));

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-[var(--color-background)]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-[var(--color-border)] border-t-[var(--color-primary)] mx-auto mb-4"></div>
                    <p className="text-[var(--color-text-secondary)] text-sm">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-[var(--color-background)]">
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Welcome back</h1>
                        <p className="text-[var(--color-text-secondary)] text-sm">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    <BrandLogo size="md" showText={true} />
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <Icon name="Code" className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.totalHistory}</p>
                                <p className="text-xs text-[var(--color-text-tertiary)]">History Items</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                                <Icon name="FileText" className="w-5 h-5 text-yellow-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.totalNotes}</p>
                                <p className="text-xs text-[var(--color-text-tertiary)]">Notes</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                                <Icon name="Pen" className="w-5 h-5 text-pink-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.totalDrawings}</p>
                                <p className="text-xs text-[var(--color-text-tertiary)]">Drawings</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                <Icon name="Calendar" className="w-5 h-5 text-green-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                                    {stats.totalTasks > 0 ? `${stats.completedTasks}/${stats.totalTasks}` : '0'}
                                </p>
                                <p className="text-xs text-[var(--color-text-tertiary)]">Today's Tasks</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    {/* Quick Access */}
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-5">
                        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                            <Icon name="Zap" className="w-5 h-5 text-[var(--color-primary)]" />
                            Quick Access
                        </h2>
                        <div className="grid grid-cols-3 gap-3">
                            {quickAccessItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        // This will be handled by parent component
                                        if ((window as any).openTool) {
                                            (window as any).openTool(item.id);
                                        }
                                    }}
                                    className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-sidebar)] hover:bg-[var(--color-muted)] hover:border-[var(--color-primary)]/50 transition-all group"
                                >
                                    <div className={`w-10 h-10 ${item.color} rounded-lg flex items-center justify-center mb-2 mx-auto group-hover:scale-110 transition-transform`}>
                                        <Icon name={item.icon as keyof typeof import('./Icons').Icons} className="w-5 h-5 text-white" />
                                    </div>
                                    <p className="text-xs font-medium text-[var(--color-text-primary)] text-center">{item.label}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Planner Preview */}
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                                <Icon name="Calendar" className="w-5 h-5 text-[var(--color-primary)]" />
                                Today's Tasks
                            </h2>
                            <button
                                onClick={() => {
                                    const today = formatDateLocal();
                                    if ((window as any).openTool) {
                                        (window as any).openTool('planner', { date: today });
                                    }
                                }}
                                className="text-xs text-[var(--color-primary)] hover:underline"
                            >
                                View All →
                            </button>
                        </div>
                        {todayTasks.length === 0 ? (
                            <div className="text-center py-8 text-[var(--color-text-tertiary)] text-sm">
                                <Icon name="Calendar" className="w-8 h-8 mx-auto mb-2 text-[var(--color-text-tertiary)]" />
                                <p>No tasks for today</p>
                                <button
                                    onClick={() => {
                                        const today = formatDateLocal();
                                        if ((window as any).openTool) {
                                            (window as any).openTool('planner', { date: today, addTask: true });
                                        }
                                    }}
                                    className="mt-3 px-4 py-2 bg-[var(--color-primary)] text-white rounded text-xs hover:opacity-90 transition-opacity"
                                >
                                    Add Tasks
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                                {todayTasks.slice(0, 5).map((task) => (
                                    <div
                                        key={task.id}
                                        className={`flex items-center gap-2 p-2 rounded ${
                                            task.completed ? 'bg-[var(--color-muted)] opacity-60' : 'bg-[var(--color-sidebar)]'
                                        }`}
                                    >
                                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                            task.completed
                                                ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                                                : 'border-[var(--color-border)]'
                                        }`}>
                                            {task.completed && (
                                                <Icon name="Check" className="w-3 h-3 text-white" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm ${task.completed ? 'line-through text-[var(--color-text-tertiary)]' : 'text-[var(--color-text-primary)]'}`}>
                                                {task.title || 'Untitled Task'}
                                            </p>
                                            {task.time && (
                                                <p className="text-xs text-[var(--color-text-tertiary)]">{task.time}</p>
                                            )}
                                        </div>
                                        {task.priority && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                                task.priority === 'high' ? 'bg-red-500/20 text-red-500' :
                                                task.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-500' :
                                                'bg-blue-500/20 text-blue-500'
                                            }`}>
                                                {task.priority}
                                            </span>
                                        )}
                                    </div>
                                ))}
                                {todayTasks.length > 5 && (
                                    <p className="text-xs text-[var(--color-text-tertiary)] text-center pt-2">
                                        +{todayTasks.length - 5} more tasks
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                            <Icon name="Search" className="w-5 h-5 text-[var(--color-primary)]" />
                            Recent Activity
                        </h2>
                    </div>
                    {recentActivities.length === 0 ? (
                        <div className="text-center py-8 text-[var(--color-text-tertiary)] text-sm">
                            No recent activity
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recentActivities
                                .slice(0, 10) // Limit to 10 items
                                .map((activity) => {
                                    // Map activity type to tab type
                                    const getTabType = (type: string): string => {
                                        switch (type) {
                                            case 'note':
                                                return 'notes';
                                            case 'drawing':
                                                return 'excalidraw';
                                            case 'planner':
                                                return 'planner';
                                            case 'history':
                                                // History items can be different types - try to infer from title
                                                if (activity.title.toLowerCase().includes('schema')) {
                                                    return 'schema';
                                                } else if (activity.title.toLowerCase().includes('api')) {
                                                    return 'api';
                                                } else if (activity.title.toLowerCase().includes('uml')) {
                                                    return 'uml';
                                                }
                                                return 'schema'; // Default to schema
                                            default:
                                                return 'home';
                                        }
                                    };

                                    const tabType = getTabType(activity.type);

                                    return (
                                        <div
                                            key={activity.id}
                                            onClick={() => {
                                                if ((window as any).openTool) {
                                                    // Pass the item ID for notes and drawings
                                                    if (activity.type === 'note' || activity.type === 'drawing') {
                                                        (window as any).openTool(tabType, activity.id);
                                                    } else {
                                                        (window as any).openTool(tabType);
                                                    }
                                                }
                                            }}
                                            className="flex items-center gap-3 p-3 rounded hover:bg-[var(--color-muted)] transition-colors group cursor-pointer"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-[var(--color-muted)] flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--color-primary)]/10 transition-colors">
                                                {activity.type === 'history' && <Icon name="Code" className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)]" />}
                                                {activity.type === 'note' && <Icon name="FileText" className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)]" />}
                                                {activity.type === 'drawing' && <Icon name="Pen" className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)]" />}
                                                {activity.type === 'planner' && <Icon name="Calendar" className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)]" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-primary)] transition-colors">
                                                    {activity.title}
                                                </p>
                                                <p className="text-xs text-[var(--color-text-tertiary)]">
                                                    {formatTimeAgo(activity.timestamp)}
                                                </p>
                                            </div>
                                            <span className="text-[10px] px-2 py-1 rounded bg-[var(--color-muted)] text-[var(--color-text-tertiary)] capitalize group-hover:bg-[var(--color-primary)]/10 group-hover:text-[var(--color-primary)] transition-colors">
                                                {activity.type}
                                            </span>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

