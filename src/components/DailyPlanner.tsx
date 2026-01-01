import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Icon } from './Icon';
import { getPlannerEntry, getPlannerEntries, savePlannerEntry, PlannerEntry, PlannerTask, TimeBlock, PlannerReflection, Habit, getAllHabits, saveHabit, deleteHabit, getHabitCompletions, getAllHabitCompletions, setHabitCompletion } from '../services/sync';
import { formatDateLocal } from '../utils/dateUtils';

type TaskFilter = 'all' | 'active' | 'completed' | 'blocked';
type ViewMode = 'day' | 'week' | 'analytics';

export function DailyPlanner() {
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        // Check if there's a pending date from Home page
        const pendingDate = (window as any).__pendingPlannerDate;
        if (pendingDate) {
            delete (window as any).__pendingPlannerDate;
            return pendingDate;
        }
        return formatDateLocal();
    });
    // Daily Overview
    const [energyLevel, setEnergyLevel] = useState<'low' | 'medium' | 'high' | undefined>(undefined);
    const [workMode, setWorkMode] = useState<'deep-work' | 'meetings' | 'mixed' | undefined>(undefined);
    const [priorities, setPriorities] = useState<string[]>([]);
    // Time Blocks
    const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
    // Tasks
    const [tasks, setTasks] = useState<PlannerTask[]>([]);
    // Scratchpad
    const [scratchpad, setScratchpad] = useState<string>('');
    // Reflection
    const [reflection, setReflection] = useState<PlannerReflection>({});

    const [loading, setLoading] = useState(false);
    const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
    const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
    const [savedTaskId, setSavedTaskId] = useState<string | null>(null);
    // Use priorities field to store focus task IDs (already persisted in backend)
    const focusTasks = priorities; // Task IDs marked as focus
    const [showCompleted, setShowCompleted] = useState(false); // Collapse completed tasks by default
    const [showReflection, setShowReflection] = useState(false); // Collapse reflection by default
    const [showHabits, setShowHabits] = useState(true); // Collapsible habits section
    
    // New innovative features
    const [habits, setHabits] = useState<Array<Habit & { completed: boolean; streak: number; totalCompletions: number }>>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('day');
    const [taskTemplates] = useState([
        { title: 'Code Review', priority: 'P1' as const, estimatedTime: 30 },
        { title: 'Write Documentation', priority: 'P2' as const, estimatedTime: 45 },
        { title: 'Fix Bug', priority: 'P0' as const, estimatedTime: 60 },
        { title: 'Team Meeting', priority: 'P1' as const, estimatedTime: 30 },
        { title: 'Design Review', priority: 'P2' as const, estimatedTime: 45 },
    ]);
    
    // Week view state
    const [weekStartDate, setWeekStartDate] = useState<string>(() => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek; // Get Sunday of current week
        const sunday = new Date(today);
        sunday.setDate(today.getDate() - dayOfWeek);
        return formatDateLocal(sunday);
    });
    const [weekEntries, setWeekEntries] = useState<PlannerEntry[]>([]);
    const [loadingWeek, setLoadingWeek] = useState(false);
    const [weekHabitsCompletions, setWeekHabitsCompletions] = useState<Record<string, Record<string, boolean>>>({});
    
    // Analytics state
    const [analyticsData, setAnalyticsData] = useState<{
        weekEntries: PlannerEntry[];
        loading: boolean;
    }>({
        weekEntries: [],
        loading: false
    });

    // Load habits from separate storage and calculate completion status for selected date
    const loadHabitsForDate = useCallback(async (date: string) => {
        try {
            // Get all habits from separate storage
            const allHabitsList = await getAllHabits();
            
            // Get all completions
            const allCompletions = await getAllHabitCompletions();
            
            // Calculate streaks and totals for each habit
            const habitsWithStatus = await Promise.all(allHabitsList.map(async (habit) => {
                const completions = allCompletions[habit.id] || {};
                const isCompletedToday = completions[date] === true;
                
                // Calculate streak by checking backwards from today
                let currentStreak = 0;
                const today = new Date(date);
                let checkDate = new Date(today);
                
                // Check backwards to find consecutive completions
                for (let i = 0; i < 365; i++) {
                    const dateStr = formatDateLocal(checkDate);
                    if (completions[dateStr] === true) {
                        currentStreak++;
                    } else {
                        break; // Streak broken
                    }
                    checkDate.setDate(checkDate.getDate() - 1);
                }
                
                // Count total completions in last 30 days
                const monthAgo = new Date(today);
                monthAgo.setDate(monthAgo.getDate() - 30);
                let totalCompletions = 0;
                Object.keys(completions).forEach(completionDate => {
                    if (completionDate >= formatDateLocal(monthAgo) && completions[completionDate] === true) {
                        totalCompletions++;
                    }
                });
                
                return {
                    ...habit,
                    completed: isCompletedToday,
                    streak: currentStreak,
                    totalCompletions
                };
            }));
            
            setHabits(habitsWithStatus);
        } catch (error: any) {
            console.error('Failed to load habits:', error);
            setHabits([]);
        }
    }, []);

    // Load entry function - defined early so it can be used in useEffect hooks
    const loadEntry = useCallback(async (showLoading: boolean = true) => {
        if (showLoading) {
            setLoading(true);
        }
        try {
            const loadedEntry = await getPlannerEntry(selectedDate);
            if (loadedEntry) {
                // Only update state if values actually changed to prevent unnecessary re-renders
                setTasks(prev => JSON.stringify(prev) !== JSON.stringify(loadedEntry.tasks || []) ? (loadedEntry.tasks || []) : prev);
                setEnergyLevel(loadedEntry.energyLevel);
                setWorkMode(loadedEntry.workMode);
                setPriorities(loadedEntry.priorities || []);
                setTimeBlocks(loadedEntry.timeBlocks || []);
                setScratchpad(loadedEntry.scratchpad || '');
                setReflection(loadedEntry.reflection || {});
            } else {
                setTasks([]);
                setEnergyLevel(undefined);
                setWorkMode(undefined);
                setPriorities([]);
                setTimeBlocks([]);
                setScratchpad('');
                setReflection({});
            }
            
            // Load habits separately from habits storage
            await loadHabitsForDate(selectedDate);
        } catch (error: any) {
            console.error('Failed to load planner entry:', error);
            if ((window as any).showToast) {
                (window as any).showToast(`Failed to load planner: ${error.message || 'Unknown error'}`, 'error');
            }
        } finally {
            if (showLoading) {
                setLoading(false);
            }
        }
    }, [selectedDate, loadHabitsForDate]);

    useEffect(() => {
        loadEntry(true); // Show loading on initial load
    }, [loadEntry]);

    // Track the date that tasks are currently loaded for
    const tasksDateRef = useRef<string>(selectedDate);
    
    // Update tasksDateRef when tasks are loaded
    useEffect(() => {
        tasksDateRef.current = selectedDate;
    }, [selectedDate, tasks]);

    const loadWeekData = useCallback(async () => {
        setLoadingWeek(true);
        try {
            const startDate = new Date(weekStartDate);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6); // 7 days total
            
            const entries = await getPlannerEntries(
                formatDateLocal(startDate),
                formatDateLocal(endDate)
            );
            
            // Load habits completions for the week
            const allCompletions = await getAllHabitCompletions(
                formatDateLocal(startDate),
                formatDateLocal(endDate)
            );
            
            setWeekEntries(entries);
            setWeekHabitsCompletions(allCompletions);
        } catch (error: any) {
            console.error('Failed to load week data:', error);
        } finally {
            setLoadingWeek(false);
        }
    }, [weekStartDate]);

    const loadAnalyticsData = useCallback(async () => {
        setAnalyticsData(prev => ({ ...prev, loading: true }));
        try {
            const today = new Date();
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            
            const entries = await getPlannerEntries(
                formatDateLocal(weekAgo),
                formatDateLocal(today)
            );
            setAnalyticsData({ weekEntries: entries, loading: false });
        } catch (error: any) {
            console.error('Failed to load analytics data:', error);
            setAnalyticsData(prev => ({ ...prev, loading: false }));
        }
    }, []);

    // Load week data when in week view
    useEffect(() => {
        if (viewMode === 'week') {
            loadWeekData();
        }
    }, [weekStartDate, viewMode, loadWeekData]);

    // Load analytics data when in analytics view
    useEffect(() => {
        if (viewMode === 'analytics') {
            loadAnalyticsData();
        }
    }, [viewMode, loadAnalyticsData]);


    // Polling: Refresh data every 5 seconds when on planner (only if multiple devices, skip if saving)
    const [hasMultipleDevices, setHasMultipleDevices] = useState(false);

    useEffect(() => {
        // Device check removed - no longer required
        setHasMultipleDevices(false);
    }, []);

    const [isCreatingTask, setIsCreatingTask] = useState(false);

    useEffect(() => {
        // Only poll if user has multiple devices
        if (!hasMultipleDevices) return;

        const interval = setInterval(() => {
            // Don't poll if we're currently saving a task or creating a new one
            if (!savingTaskId && !isCreatingTask && !loading) {
                loadEntry(false); // Don't show loading during polling
            }
        }, 5000); // Poll every 5 seconds

        return () => clearInterval(interval);
    }, [loadEntry, savingTaskId, hasMultipleDevices, isCreatingTask, loading]);

    // Listen for planner updates from other windows
    useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.planner?.onUpdate) {
            const handleUpdate = (date: string) => {
                // If the update is for the current date, reload the entry
                if (date === selectedDate) {
                    loadEntry(false); // Don't show loading for updates
                }
            };
            (window as any).electronAPI.planner.onUpdate(handleUpdate);
        }
    }, [selectedDate, loadEntry]);

    const handleOpenInNewWindow = useCallback(() => {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.window?.openPlanner) {
            (window as any).electronAPI.window.openPlanner();
        }
    }, []);

    const saveTask = useCallback(async (taskId: string, updatedTasks?: PlannerTask[]) => {
        setSavingTaskId(taskId);
        setIsCreatingTask(false); // Reset creating flag when saving
        try {
            // Use updatedTasks if provided, otherwise use current tasks state
            // This ensures we save the latest state, not stale closure state
            const tasksToSave = updatedTasks || tasks;
            const entry: PlannerEntry = {
                date: selectedDate,
                energyLevel,
                workMode,
                priorities: priorities.slice(0, 3),
                timeBlocks,
                tasks: tasksToSave,
                scratchpad,
                reflection
            };
            const saved = await savePlannerEntry(entry);
            // Update local state with saved data to ensure consistency
            if (saved) {
                setTasks(saved.tasks || tasksToSave);
            }
            // Collapse the task after successful save
            if (expandedTaskId === taskId) {
                setExpandedTaskId(null);
            }
            // Show success indicator
            setSavedTaskId(taskId);
            setTimeout(() => {
                setSavedTaskId(null);
            }, 2000);
            if (saved && (window as any).showToast) {
                (window as any).showToast('Task saved successfully', 'success');
            }
            // Broadcast update to other windows
            if (typeof window !== 'undefined' && (window as any).electronAPI?.planner?.broadcastUpdate) {
                (window as any).electronAPI.planner.broadcastUpdate(selectedDate);
            }
        } catch (error: any) {
            console.error('Failed to save task:', error);
            if ((window as any).showToast) {
                (window as any).showToast(`Failed to save task: ${error.message || 'Unknown error'}`, 'error');
            }
        } finally {
            setSavingTaskId(null);
        }
    }, [selectedDate, energyLevel, workMode, priorities, timeBlocks, tasks, scratchpad, reflection, expandedTaskId]);

    // Today's Focus tasks (max 3, not done)
    const focusTasksList = useMemo(() => {
        return tasks
            .filter(t => focusTasks.includes(t.id) && t.status !== 'done')
            .slice(0, 3);
    }, [tasks, focusTasks]);

    // Active tasks (excluding focus tasks and completed)
    const activeTasks = useMemo(() => {
        return tasks.filter(t =>
            (t.status === 'todo' || t.status === 'in-progress') &&
            !focusTasks.includes(t.id)
        );
    }, [tasks, focusTasks]);

    // Completed tasks
    const completedTasks = useMemo(() => {
        return tasks.filter(t => t.status === 'done');
    }, [tasks]);

    // Filtered tasks based on filter
    const filteredTasks = useMemo(() => {
        switch (taskFilter) {
            case 'active':
                return tasks.filter(t => t.status === 'todo' || t.status === 'in-progress');
            case 'completed':
                return tasks.filter(t => t.status === 'done');
            case 'blocked':
                return tasks.filter(t => t.status === 'blocked');
            default:
                return tasks;
        }
    }, [tasks, taskFilter]);

    // Statistics
    const stats = useMemo(() => {
        const total = tasks.length;
        const done = tasks.filter(t => t.status === 'done').length;
        const inProgress = tasks.filter(t => t.status === 'in-progress').length;
        const blocked = tasks.filter(t => t.status === 'blocked').length;
        const active = tasks.filter(t => t.status === 'todo' || t.status === 'in-progress').length;
        const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
        return { total, done, inProgress, blocked, active, completionRate };
    }, [tasks]);

    const handleTaskToggle = useCallback(async (taskId: string) => {
        const updatedTasks = tasks.map(task => {
            if (task.id === taskId) {
                const currentStatus = task.status || (task.completed ? 'done' : 'todo');
                const newStatus: 'todo' | 'in-progress' | 'done' | 'blocked' = currentStatus === 'done' ? 'todo' : 'done';
                return {
                    ...task,
                    status: newStatus,
                    completed: newStatus === 'done' // Keep backward compatibility
                };
            }
            return task;
        });
        setTasks(updatedTasks);

        // Auto-save completion status immediately
        try {
            const entry: PlannerEntry = {
                date: selectedDate,
                energyLevel,
                workMode,
                priorities: priorities.slice(0, 3),
                timeBlocks,
                tasks: updatedTasks,
                scratchpad,
                reflection
            };
            await savePlannerEntry(entry);
            // Broadcast update to other windows
            if (typeof window !== 'undefined' && (window as any).electronAPI?.planner?.broadcastUpdate) {
                (window as any).electronAPI.planner.broadcastUpdate(selectedDate);
            }
        } catch (error: any) {
            console.error('Failed to save task completion:', error);
            if ((window as any).showToast) {
                (window as any).showToast(`Failed to save task completion: ${error.message || 'Unknown error'}`, 'error');
            }
        }
    }, [tasks, selectedDate, energyLevel, workMode, priorities, timeBlocks, scratchpad, reflection]);

    const handleAddTask = useCallback(async () => {
        // If data is still loading for the selected date, wait for it to complete
        // This ensures we're adding tasks to the correct date
        if (loading) {
            // Wait for loading to complete (with timeout)
            let waitCount = 0;
            while (loading && waitCount < 20) { // Max 2 seconds (20 * 100ms)
                await new Promise(resolve => setTimeout(resolve, 100));
                waitCount++;
            }
        }

        // Double-check: if tasks are from a different date, reload for current date
        if (tasksDateRef.current !== selectedDate) {
            // Data hasn't loaded yet for the selected date, reload it
            await loadEntry(false); // Don't show loading spinner
        }

        setIsCreatingTask(true);
        const newTask: PlannerTask = {
            id: Date.now().toString(),
            title: '',
            status: 'todo',
            priority: 'P1',
            completed: false // Backward compatibility
        };
        
        // Use current tasks - they should now be for the correct date
        const updatedTasks = [...tasks, newTask];
        setTasks(updatedTasks);
        setExpandedTaskId(newTask.id);
        
        // Save the task immediately - saveTask uses selectedDate, so it will save to correct date
        await saveTask(newTask.id, updatedTasks);
        
        // Reset flag after a short delay
        setTimeout(() => setIsCreatingTask(false), 1000);
    }, [tasks, loading, selectedDate, saveTask, loadEntry]);

    const handleTaskDelete = useCallback(async (taskId: string) => {
        try {
            const updatedTasks = tasks.filter(t => t.id !== taskId);
            setTasks(updatedTasks);
            if (expandedTaskId === taskId) {
                setExpandedTaskId(null);
            }
            // Save the deletion to backend
            await saveTask(taskId, updatedTasks);
            if ((window as any).showToast) {
                (window as any).showToast('Task deleted', 'success');
            }
        } catch (error: any) {
            console.error('Failed to delete task:', error);
            if ((window as any).showToast) {
                (window as any).showToast(`Failed to delete task: ${error.message || 'Unknown error'}`, 'error');
            }
        }
    }, [tasks, expandedTaskId, saveTask]);

    const handleMoveTaskToNextDay = useCallback(async (taskId: string) => {
        try {
            // Get the task to move
            const taskToMove = tasks.find(t => t.id === taskId);
            if (!taskToMove) return;

            // Calculate next day
            const currentDate = new Date(selectedDate);
            const nextDate = new Date(currentDate);
            nextDate.setDate(nextDate.getDate() + 1);
            const nextDateStr = formatDateLocal(nextDate);

            // Get next day's entry
            const nextDayEntry = await getPlannerEntry(nextDateStr);
            const nextDayTasks = nextDayEntry?.tasks || [];

            // Check if task already exists in next day (by title)
            const taskExists = nextDayTasks.some(t => t.title === taskToMove.title && t.id !== taskToMove.id);
            if (taskExists) {
                if ((window as any).showToast) {
                    (window as any).showToast('Task already exists in next day', 'warning');
                }
                return;
            }

            // Create new task for next day (reset status to todo)
            const movedTask: PlannerTask = {
                ...taskToMove,
                id: Date.now().toString(), // New ID for the moved task
                status: 'todo',
                completed: false
            };

            // Add task to next day
            const updatedNextDayTasks = [...nextDayTasks, movedTask];
            const nextDayEntryToSave: PlannerEntry = {
                date: nextDateStr,
                tasks: updatedNextDayTasks,
                energyLevel: nextDayEntry?.energyLevel,
                workMode: nextDayEntry?.workMode,
                priorities: nextDayEntry?.priorities || [],
                timeBlocks: nextDayEntry?.timeBlocks || [],
                scratchpad: nextDayEntry?.scratchpad || '',
                reflection: nextDayEntry?.reflection || {}
            };
            await savePlannerEntry(nextDayEntryToSave);

            // Remove task from current day
            const updatedCurrentTasks = tasks.filter(t => t.id !== taskId);
            setTasks(updatedCurrentTasks);
            await saveTask(taskId, updatedCurrentTasks);

            if ((window as any).showToast) {
                (window as any).showToast(`Task moved to ${nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, 'success');
            }
        } catch (error: any) {
            console.error('Failed to move task to next day:', error);
            if ((window as any).showToast) {
                (window as any).showToast(`Failed to move task: ${error.message || 'Unknown error'}`, 'error');
            }
        }
    }, [tasks, selectedDate, saveTask]);

    const handleTaskUpdate = useCallback((taskId: string, updates: Partial<PlannerTask>) => {
        const updatedTasks = tasks.map(task =>
            task.id === taskId ? { ...task, ...updates } : task
        );
        setTasks(updatedTasks);
    }, [tasks]);

    const savePlannerData = useCallback(async (overrides?: {
        energyLevel?: 'low' | 'medium' | 'high' | undefined;
        workMode?: 'deep-work' | 'meetings' | 'mixed' | undefined;
        priorities?: string[];
        scratchpad?: string;
        reflection?: PlannerReflection;
    }) => {
        try {
            const entry: PlannerEntry = {
                date: selectedDate,
                energyLevel: overrides?.energyLevel !== undefined ? overrides.energyLevel : energyLevel,
                workMode: overrides?.workMode !== undefined ? overrides.workMode : workMode,
                priorities: (overrides?.priorities ?? priorities).slice(0, 3),
                timeBlocks,
                tasks,
                scratchpad: overrides?.scratchpad !== undefined ? overrides.scratchpad : scratchpad,
                reflection: overrides?.reflection !== undefined ? overrides.reflection : reflection,
                // Note: habits are now stored separately in habits/ folder
            };
            await savePlannerEntry(entry);
            // Broadcast update to other windows
            if (typeof window !== 'undefined' && (window as any).electronAPI?.planner?.broadcastUpdate) {
                (window as any).electronAPI.planner.broadcastUpdate(selectedDate);
            }
        } catch (err) {
            console.error('Failed to save planner entry:', err);
        }
    }, [selectedDate, energyLevel, workMode, priorities, timeBlocks, tasks, scratchpad, reflection]);

    const handleToggleFocus = useCallback(async (taskId: string) => {
        const newFocusTasks = focusTasks.includes(taskId)
            ? focusTasks.filter(id => id !== taskId)
            : focusTasks.length < 3
                ? [...focusTasks, taskId]
                : focusTasks;
        setPriorities(newFocusTasks);
        // Save to backend
        await savePlannerData({ priorities: newFocusTasks });
    }, [focusTasks, savePlannerData]);

    // Get task type icon based on title/content
    const getTaskIcon = (task: PlannerTask) => {
        const title = task.title.toLowerCase();
        if (title.includes('bug') || title.includes('fix') || title.includes('error')) return '🐞';
        if (title.includes('test') || title.includes('spec')) return '🧪';
        if (title.includes('review') || title.includes('pr')) return '🧠';
        if (title.includes('doc') || title.includes('readme')) return '📄';
        return '•';
    };

    const handleDateChange = useCallback((date: string) => {
        if (date !== selectedDate) {
            setSelectedDate(date);
            setExpandedTaskId(null);
            setTaskFilter('all');
            // loadEntry will be triggered by useEffect when selectedDate changes
        }
    }, [selectedDate]);

    // Check for pending date from Home page when component becomes visible
    // This must be after handleDateChange is defined
    useEffect(() => {
        const checkPendingDate = () => {
            const pendingDate = (window as any).__pendingPlannerDate;
            const shouldAddTask = (window as any).__pendingAddTask;
            
            if (pendingDate && pendingDate !== selectedDate) {
                // Clear the pending date
                delete (window as any).__pendingPlannerDate;
                // Update to the pending date
                handleDateChange(pendingDate);
                
                // If addTask flag is set, wait for data to load then add task
                if (shouldAddTask) {
                    delete (window as any).__pendingAddTask;
                    // Wait for data to load, then add task
                    setTimeout(async () => {
                        await loadEntry(false);
                        // Small delay to ensure state is updated
                        setTimeout(() => {
                            handleAddTask();
                        }, 300);
                    }, 500);
                }
            } else if (shouldAddTask && !pendingDate) {
                // If just addTask flag without date change, add task immediately
                delete (window as any).__pendingAddTask;
                handleAddTask();
            }
        };
        
        // Check immediately
        checkPendingDate();
        
        // Also check after a short delay to catch cases where the date is set just before component renders
        const timeout = setTimeout(checkPendingDate, 200);
        return () => clearTimeout(timeout);
    }, [selectedDate, handleDateChange, loadEntry, handleAddTask]);

    const navigateDate = useCallback((direction: 'prev' | 'next') => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + (direction === 'next' ? 1 : -1));
        handleDateChange(formatDateLocal(date));
    }, [selectedDate, handleDateChange]);

    const goToToday = useCallback(() => {
        const today = formatDateLocal();
        handleDateChange(today);
    }, [handleDateChange]);

    const getPriorityColor = (priority?: 'P0' | 'P1' | 'P2' | 'low' | 'medium' | 'high') => {
        // Support both old and new priority formats
        if (priority === 'P0' || priority === 'high') {
            return 'bg-red-500/20 text-red-500 border-red-500/30';
        }
        if (priority === 'P1' || priority === 'medium') {
            return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
        }
        if (priority === 'P2' || priority === 'low') {
            return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
        }
        return 'bg-gray-500/20 text-gray-500 border-gray-500/30';
    };

    const getPriorityLabel = (priority?: 'P0' | 'P1' | 'P2' | 'low' | 'medium' | 'high') => {
        if (priority === 'P0') return 'P0';
        if (priority === 'P1') return 'P1';
        if (priority === 'P2') return 'P2';
        if (priority === 'high') return 'High';
        if (priority === 'medium') return 'Medium';
        if (priority === 'low') return 'Low';
        return 'None';
    };

    const getStatusColor = (status: 'todo' | 'in-progress' | 'done' | 'blocked') => {
        switch (status) {
            case 'done':
                return 'bg-green-500/20 text-green-500 border-green-500/30';
            case 'in-progress':
                return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
            case 'blocked':
                return 'bg-red-500/20 text-red-500 border-red-500/30';
            default:
                return 'bg-gray-500/20 text-gray-500 border-gray-500/30';
        }
    };

    const getStatusLabel = (status: 'todo' | 'in-progress' | 'done' | 'blocked') => {
        switch (status) {
            case 'done':
                return 'Done';
            case 'in-progress':
                return 'In Progress';
            case 'blocked':
                return 'Blocked';
            default:
                return 'Todo';
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (dateString === formatDateLocal(today)) {
            return 'Today';
        } else if (dateString === formatDateLocal(tomorrow)) {
            return 'Tomorrow';
        } else if (dateString === formatDateLocal(yesterday)) {
            return 'Yesterday';
        }
        return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    // Check if we're in a separate planner window (window title contains "Daily Planner")
    const isPlannerWindow = typeof window !== 'undefined' &&
        (window.document.title.includes('Daily Planner') ||
            window.location.pathname.includes('planner'));

    // Check if we're on macOS
    const isMac = typeof navigator !== 'undefined' &&
        (navigator.platform.toUpperCase().indexOf('MAC') >= 0 ||
            navigator.userAgent.toUpperCase().indexOf('MAC') >= 0);

    return (
        <div className="h-full flex flex-col bg-[var(--color-background)]">
            {/* Header */}
            <div
                className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between flex-shrink-0"
                style={isPlannerWindow && isMac ? {
                    WebkitAppRegion: 'drag' as any,
                    cursor: 'default'
                } as React.CSSProperties : {}}
            >
                {/* Date Navigation - Primary */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigateDate('prev')}
                        className="p-1.5 rounded hover:bg-[var(--color-muted)] transition-colors"
                        title="Previous day"
                        style={isPlannerWindow && isMac ? {
                            WebkitAppRegion: 'no-drag' as any
                        } as React.CSSProperties : {}}
                    >
                        <Icon name="ChevronLeft" className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    </button>
                    <button
                        onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'date';
                            input.value = selectedDate;
                            input.onchange = (e) => {
                                const target = e.target as HTMLInputElement;
                                if (target.value) handleDateChange(target.value);
                            };
                            input.click();
                        }}
                        className="px-3 py-1.5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-muted)] rounded transition-colors"
                        style={isPlannerWindow && isMac ? {
                            WebkitAppRegion: 'no-drag' as any
                        } as React.CSSProperties : {}}
                    >
                        {new Date(selectedDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </button>
                    <button
                        onClick={() => navigateDate('next')}
                        className="p-1.5 rounded hover:bg-[var(--color-muted)] transition-colors"
                        title="Next day"
                        style={isPlannerWindow && isMac ? {
                            WebkitAppRegion: 'no-drag' as any
                        } as React.CSSProperties : {}}
                    >
                        <Icon name="ChevronRight" className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    </button>
                </div>

                {/* Stats Badge - Compact */}
                <div
                    className="flex items-center gap-2"
                    style={isPlannerWindow && isMac ? {
                        WebkitAppRegion: 'no-drag' as any
                    } as React.CSSProperties : {}}
                >
                    {loading && (
                        <div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></div>
                    )}
                    {stats.total > 0 && (
                        <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]"></span>
                            <span className="font-medium">{stats.completionRate}% Done</span>
                        </div>
                    )}
                    {typeof window !== 'undefined' && (window as any).electronAPI?.window?.openPlanner && !isPlannerWindow && (
                        <button
                            onClick={handleOpenInNewWindow}
                            className="p-1.5 rounded hover:bg-[var(--color-muted)] transition-colors"
                            title="Open in new window"
                        >
                            <Icon name="Maximize" className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                <div className="max-w-4xl mx-auto space-y-4">
                    {/* View Mode Toggle */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 bg-[var(--color-muted)] rounded-lg p-1">
                            {(['day', 'week', 'analytics'] as ViewMode[]).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                                        viewMode === mode
                                            ? 'bg-[var(--color-primary)] text-white'
                                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                    }`}
                                >
                                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Daily Overview Section - Redesigned */}
                    {viewMode === 'day' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Energy Level Card */}
                        <div className="bg-gradient-to-br from-[var(--color-card)] to-[var(--color-card)]/80 border border-[var(--color-border)] rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <Icon name="Zap" className="w-4 h-4 text-blue-500" />
                                </div>
                                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Energy Level</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                {(['low', 'medium', 'high'] as const).map((level) => {
                                    const colors = {
                                        low: 'from-red-500/20 to-red-500/10 border-red-500/30 text-red-500',
                                        medium: 'from-yellow-500/20 to-yellow-500/10 border-yellow-500/30 text-yellow-500',
                                        high: 'from-green-500/20 to-green-500/10 border-green-500/30 text-green-500'
                                    };
                                    return (
                                        <button
                                            key={level}
                                            onClick={async () => {
                                                const newLevel = energyLevel === level ? undefined : level;
                                                setEnergyLevel(newLevel);
                                                await savePlannerData({ energyLevel: newLevel });
                                            }}
                                            className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                                                energyLevel === level
                                                    ? `bg-gradient-to-br ${colors[level]} border-2 shadow-sm`
                                                    : 'bg-[var(--color-muted)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-primary)]/30'
                                            }`}
                                        >
                                            {level.charAt(0).toUpperCase() + level.slice(1)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Work Mode Card */}
                        <div className="bg-gradient-to-br from-[var(--color-card)] to-[var(--color-card)]/80 border border-[var(--color-border)] rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-2 bg-purple-500/10 rounded-lg">
                                    <Icon name="Briefcase" className="w-4 h-4 text-purple-500" />
                                </div>
                                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Work Mode</h3>
                            </div>
                            <div className="flex items-center gap-1.5">
                                {(['deep-work', 'meetings', 'mixed'] as const).map((mode) => {
                                    const labels = {
                                        'deep-work': 'Deep',
                                        'meetings': 'Meetings',
                                        'mixed': 'Mixed'
                                    };
                                    return (
                                        <button
                                            key={mode}
                                            onClick={async () => {
                                                const newMode = workMode === mode ? undefined : mode;
                                                setWorkMode(newMode);
                                                await savePlannerData({ workMode: newMode });
                                            }}
                                            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
                                                workMode === mode
                                                    ? 'bg-gradient-to-br from-purple-500/20 to-purple-500/10 border-2 border-purple-500/30 text-purple-500 shadow-sm'
                                                    : 'bg-[var(--color-muted)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-primary)]/30'
                                            }`}
                                        >
                                            {labels[mode]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Quick Stats Card */}
                        <div className="bg-gradient-to-br from-[var(--color-card)] to-[var(--color-card)]/80 border border-[var(--color-border)] rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-2 bg-[var(--color-primary)]/10 rounded-lg">
                                    <Icon name="BarChart" className="w-4 h-4 text-[var(--color-primary)]" />
                                </div>
                                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Today's Progress</h3>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-[var(--color-text-tertiary)]">Completion</span>
                                    <span className="text-sm font-bold text-[var(--color-primary)]">{stats.completionRate}%</span>
                                </div>
                                <div className="w-full h-2 bg-[var(--color-muted)] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary)]/80 transition-all"
                                        style={{ width: `${stats.completionRate}%` }}
                                    />
                                </div>
                                <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                                    <span>{stats.done} completed</span>
                                    <span>{stats.total} total</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Today's Focus Section - Redesigned */}
                    {viewMode === 'day' && focusTasksList.length > 0 && (
                        <div className="bg-gradient-to-br from-[var(--color-primary)]/10 via-[var(--color-primary)]/5 to-transparent border border-[var(--color-primary)]/20 rounded-xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-[var(--color-primary)]/20 rounded-lg">
                                        <Icon name="Target" className="w-5 h-5 text-[var(--color-primary)]" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Today's Focus</h3>
                                        <p className="text-xs text-[var(--color-text-tertiary)]">Your top priorities (max 3)</p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {focusTasksList.map((task) => {
                                    const taskStatus = (task.status || (task.completed ? 'done' : 'todo')) as 'todo' | 'in-progress' | 'done' | 'blocked';
                                    return (
                                        <div
                                            key={task.id}
                                            className="flex items-center gap-3 p-3 bg-[var(--color-card)]/80 backdrop-blur-sm border border-[var(--color-primary)]/30 rounded-lg hover:border-[var(--color-primary)]/50 transition-all group"
                                        >
                                            <button
                                                onClick={async () => {
                                                    const newStatus = taskStatus === 'done' ? 'todo' : 'done';
                                                    handleTaskUpdate(task.id, {
                                                        status: newStatus,
                                                        completed: newStatus === 'done'
                                                    });
                                                    await saveTask(task.id);
                                                }}
                                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                                    taskStatus === 'done'
                                                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] shadow-sm'
                                                        : 'border-[var(--color-border)] hover:border-[var(--color-primary)] bg-transparent'
                                                }`}
                                            >
                                                {taskStatus === 'done' && (
                                                    <Icon name="Check" className="w-3 h-3 text-white" />
                                                )}
                                            </button>
                                            <span className="text-base">{getTaskIcon(task)}</span>
                                            <span className={`text-sm flex-1 font-medium ${taskStatus === 'done' ? 'line-through text-[var(--color-text-tertiary)]' : 'text-[var(--color-text-primary)]'}`}>
                                                {task.title || 'Untitled task'}
                                            </span>
                                            {task.priority && (
                                                <span className={`px-2 py-1 text-[10px] font-semibold rounded-md border ${getPriorityColor(task.priority)}`}>
                                                    {getPriorityLabel(task.priority)}
                                                </span>
                                            )}
                                            <button
                                                onClick={() => handleToggleFocus(task.id)}
                                                className="opacity-0 group-hover:opacity-100 text-[var(--color-text-tertiary)] hover:text-red-500 transition-opacity p-1"
                                                title="Remove from focus"
                                            >
                                                <Icon name="X" className="w-4 h-4" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Quick Task Templates - Redesigned */}
                    {viewMode === 'day' && (
                    <div className="bg-gradient-to-br from-[var(--color-card)] to-[var(--color-card)]/80 border border-[var(--color-border)] rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 bg-orange-500/10 rounded-lg">
                                <Icon name="Zap" className="w-4 h-4 text-orange-500" />
                            </div>
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Quick Templates</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {taskTemplates.map((template, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        const newTask: PlannerTask = {
                                            id: Date.now().toString() + idx,
                                            title: template.title,
                                            status: 'todo',
                                            priority: template.priority,
                                            estimatedTime: template.estimatedTime,
                                            completed: false
                                        };
                                        const updatedTasks = [...tasks, newTask];
                                        setTasks(updatedTasks);
                                        setExpandedTaskId(newTask.id);
                                        saveTask(newTask.id, updatedTasks);
                                    }}
                                    className="px-4 py-2 text-xs font-medium bg-gradient-to-br from-[var(--color-muted)] to-[var(--color-muted)]/50 hover:from-[var(--color-primary)]/10 hover:to-[var(--color-primary)]/5 border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 rounded-lg transition-all"
                                >
                                    {template.title}
                                </button>
                            ))}
                        </div>
                    </div>
                    )}

                    {/* Analytics View */}
                    {viewMode === 'analytics' && (
                        <div className="space-y-4">
                            {analyticsData.loading ? (
                                <div className="text-center py-8 text-[var(--color-text-tertiary)]">Loading analytics...</div>
                            ) : (
                                <>
                                    {/* Today's Stats */}
                                    <div className="grid grid-cols-4 gap-4">
                                        <div className="bg-gradient-to-br from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-lg p-4">
                                            <div className="text-2xl font-bold text-[var(--color-primary)] mb-1">
                                                {stats.completionRate}%
                                            </div>
                                            <div className="text-xs text-[var(--color-text-secondary)]">Today's Completion</div>
                                        </div>
                                        <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                                            <div className="text-2xl font-bold text-blue-500 mb-1">
                                                {tasks.reduce((sum, t) => sum + (t.pomodoroCount || 0), 0)}
                                            </div>
                                            <div className="text-xs text-[var(--color-text-secondary)]">Pomodoros Today</div>
                                        </div>
                                        <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 rounded-lg p-4">
                                            <div className="text-2xl font-bold text-green-500 mb-1">
                                                {habits.filter(h => h.completed).length}/{habits.length || 1}
                                            </div>
                                            <div className="text-xs text-[var(--color-text-secondary)]">Habits Completed</div>
                                        </div>
                                        <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-lg p-4">
                                            <div className="text-2xl font-bold text-purple-500 mb-1">
                                                {stats.total}
                                            </div>
                                            <div className="text-xs text-[var(--color-text-secondary)]">Total Tasks</div>
                                        </div>
                                    </div>

                                    {/* Week Overview */}
                                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4">
                                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                                            <Icon name="Chart" className="w-4 h-4" />
                                            Last 7 Days Overview
                                        </h3>
                                        <div className="space-y-3">
                                            {analyticsData.weekEntries.length === 0 ? (
                                                <div className="text-sm text-[var(--color-text-tertiary)] text-center py-4">
                                                    No data for the past week
                                                </div>
                                            ) : (
                                                <>
                                                    {/* Completion Rate Chart */}
                                                    <div>
                                                        <div className="text-xs text-[var(--color-text-secondary)] mb-2">Daily Completion Rate</div>
                                                        <div className="flex items-end gap-1 h-24">
                                                            {analyticsData.weekEntries.slice(-7).map((entry, idx) => {
                                                                const total = entry.tasks.length;
                                                                const completed = entry.tasks.filter(t => t.status === 'done').length;
                                                                const rate = total > 0 ? (completed / total) * 100 : 0;
                                                                const date = new Date(entry.date);
                                                                return (
                                                                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                                                        <div className="w-full flex flex-col justify-end h-20 bg-[var(--color-muted)] rounded-t overflow-hidden">
                                                                            <div
                                                                                className="w-full bg-[var(--color-primary)] transition-all"
                                                                                style={{ height: `${rate}%` }}
                                                                            />
                                                                        </div>
                                                                        <div className="text-[10px] text-[var(--color-text-tertiary)]">
                                                                            {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                                                        </div>
                                                                        <div className="text-[10px] font-medium text-[var(--color-text-primary)]">
                                                                            {Math.round(rate)}%
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Weekly Stats */}
                                                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[var(--color-border)]">
                                                        <div>
                                                            <div className="text-xs text-[var(--color-text-secondary)] mb-1">Total Tasks</div>
                                                            <div className="text-lg font-bold text-[var(--color-text-primary)]">
                                                                {analyticsData.weekEntries.reduce((sum, e) => sum + e.tasks.length, 0)}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-xs text-[var(--color-text-secondary)] mb-1">Completed</div>
                                                            <div className="text-lg font-bold text-green-500">
                                                                {analyticsData.weekEntries.reduce((sum, e) => sum + e.tasks.filter(t => t.status === 'done').length, 0)}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-xs text-[var(--color-text-secondary)] mb-1">Total Pomodoros</div>
                                                            <div className="text-lg font-bold text-blue-500">
                                                                {analyticsData.weekEntries.reduce((sum, e) => 
                                                                    sum + (e.tasks.reduce((taskSum, t) => taskSum + (t.pomodoroCount || 0), 0)), 0
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Time Distribution */}
                                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4">
                                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                                            <Icon name="Clock" className="w-4 h-4" />
                                            Time Distribution (Today)
                                        </h3>
                                        <div className="space-y-2">
                                            {tasks.filter(t => t.actualTime && t.actualTime > 0).length > 0 ? (
                                                tasks
                                                    .filter(t => t.actualTime && t.actualTime > 0)
                                                    .sort((a, b) => (b.actualTime || 0) - (a.actualTime || 0))
                                                    .map(task => {
                                                        const totalMinutes = tasks.reduce((sum, t) => sum + (t.actualTime || 0), 0);
                                                        const percentage = totalMinutes > 0 ? ((task.actualTime || 0) / totalMinutes) * 100 : 0;
                                                        return (
                                                            <div key={task.id} className="space-y-1">
                                                                <div className="flex items-center justify-between text-sm">
                                                                    <span className="text-[var(--color-text-primary)] truncate flex-1">{task.title}</span>
                                                                    <span className="text-xs text-[var(--color-text-secondary)] ml-2">
                                                                        {Math.floor((task.actualTime || 0) / 60)}h {((task.actualTime || 0) % 60)}m
                                                                    </span>
                                                                </div>
                                                                <div className="w-full h-2 bg-[var(--color-muted)] rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-[var(--color-primary)] transition-all"
                                                                        style={{ width: `${percentage}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                            ) : (
                                                <div className="text-sm text-[var(--color-text-tertiary)] text-center py-4">
                                                    No time blocks tracked yet
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Habit Streaks */}
                                    {habits.length > 0 && (
                                        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4">
                                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                                                <Icon name="CheckCircle" className="w-4 h-4" />
                                                Habit Streaks
                                            </h3>
                                            <div className="space-y-2">
                                                {habits.map(habit => (
                                                    <div key={habit.id} className="flex items-center justify-between">
                                                        <span className="text-sm text-[var(--color-text-primary)]">{habit.name}</span>
                                                        <div className="flex items-center gap-2">
                                                            {habit.streak && habit.streak > 0 ? (
                                                                <span className="text-xs font-medium text-[var(--color-primary)] flex items-center gap-1">
                                                                    🔥 {habit.streak} day streak
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-[var(--color-text-tertiary)]">No streak yet</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Week View */}
                    {viewMode === 'week' && (
                        <div className="space-y-4">
                            {/* Week Navigation */}
                            <div className="flex items-center justify-between bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4">
                                <button
                                    onClick={() => {
                                        const date = new Date(weekStartDate);
                                        date.setDate(date.getDate() - 7);
                                        setWeekStartDate(formatDateLocal(date));
                                    }}
                                    className="p-2 rounded hover:bg-[var(--color-muted)] transition-colors"
                                >
                                    <Icon name="ChevronLeft" className="w-4 h-4" />
                                </button>
                                <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                                    {new Date(weekStartDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </div>
                                <button
                                    onClick={() => {
                                        const date = new Date(weekStartDate);
                                        date.setDate(date.getDate() + 7);
                                        setWeekStartDate(formatDateLocal(date));
                                    }}
                                    className="p-2 rounded hover:bg-[var(--color-muted)] transition-colors"
                                >
                                    <Icon name="ChevronRight" className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => {
                                        const today = new Date();
                                        const dayOfWeek = today.getDay();
                                        const diff = today.getDate() - dayOfWeek;
                                        const sunday = new Date(today);
                                        sunday.setDate(today.getDate() - dayOfWeek);
                                        setWeekStartDate(formatDateLocal(sunday));
                                    }}
                                    className="px-3 py-1.5 text-xs bg-[var(--color-primary)] text-white rounded hover:opacity-90"
                                >
                                    Today
                                </button>
                            </div>

                            {/* Week Calendar Grid */}
                            {loadingWeek ? (
                                <div className="text-center py-8 text-[var(--color-text-tertiary)]">Loading week data...</div>
                            ) : (
                                <div className="space-y-3">
                                    {/* Day headers */}
                                    <div className="grid grid-cols-7 gap-2">
                                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                                            <div key={day} className="text-xs font-semibold text-[var(--color-text-secondary)] text-center uppercase tracking-wider">
                                                {day}
                                            </div>
                                        ))}
                                    </div>
                                    {/* Calendar days */}
                                    <div className="grid grid-cols-7 gap-2">
                                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((_, idx) => {
                                            const date = new Date(weekStartDate);
                                            date.setDate(date.getDate() + idx);
                                            const dateStr = formatDateLocal(date);
                                            const isToday = dateStr === formatDateLocal();
                                            const entry = weekEntries.find(e => e.date === dateStr);
                                            const dayTasks = entry?.tasks || [];
                                            const completedCount = dayTasks.filter(t => t.status === 'done').length;
                                            const totalCount = dayTasks.length;
                                            const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                                            const dateCompletions = Object.values(weekHabitsCompletions).reduce((count, habitCompletions) => {
                                                return count + (habitCompletions[dateStr] === true ? 1 : 0);
                                            }, 0);
                                            const totalHabits = Object.keys(weekHabitsCompletions).length;

                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => {
                                                        setSelectedDate(dateStr);
                                                        setViewMode('day');
                                                    }}
                                                    className={`group relative bg-gradient-to-br from-[var(--color-card)] to-[var(--color-card)]/80 border-2 rounded-xl p-4 cursor-pointer hover:border-[var(--color-primary)] hover:shadow-lg transition-all overflow-hidden ${
                                                        isToday 
                                                            ? 'border-[var(--color-primary)] bg-gradient-to-br from-[var(--color-primary)]/15 via-[var(--color-primary)]/10 to-[var(--color-primary)]/5 shadow-lg ring-2 ring-[var(--color-primary)]/20' 
                                                            : 'border-[var(--color-border)] hover:bg-[var(--color-card)]'
                                                    }`}
                                                >
                                                    {isToday && (
                                                        <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-[var(--color-primary)] rounded-full animate-pulse"></div>
                                                    )}
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex flex-col">
                                                            <div className={`text-2xl font-bold ${isToday ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-primary)]'}`}>
                                                                {date.getDate()}
                                                            </div>
                                                            <div className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                                                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][idx]}
                                                            </div>
                                                        </div>
                                                        {completionRate > 0 && (
                                                            <div className="text-right">
                                                                <div className="text-xs font-bold text-[var(--color-primary)]">{completionRate}%</div>
                                                                <div className="text-[9px] text-[var(--color-text-tertiary)]">done</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {entry || totalCount > 0 || totalHabits > 0 ? (
                                                        <div className="space-y-2.5">
                                                            {totalCount > 0 && (
                                                                <div>
                                                                    <div className="flex items-center justify-between mb-1.5">
                                                                        <span className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">Tasks</span>
                                                                        <span className="text-[10px] font-semibold text-[var(--color-text-primary)]">{completedCount}/{totalCount}</span>
                                                                    </div>
                                                                    <div className="w-full h-2.5 bg-[var(--color-muted)] rounded-full overflow-hidden shadow-inner">
                                                                        <div
                                                                            className="h-full bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-primary)]/90 to-[var(--color-primary)]/80 transition-all shadow-sm"
                                                                            style={{ width: `${completionRate}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {totalHabits > 0 && (
                                                                <div className="flex items-center justify-between px-1 py-1 bg-green-500/10 rounded-md border border-green-500/20">
                                                                    <div className="flex items-center gap-1">
                                                                        <Icon name="CheckCircle" className="w-3 h-3 text-green-500" />
                                                                        <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">Habits</span>
                                                                    </div>
                                                                    <span className="text-[10px] font-semibold text-green-500">{dateCompletions}/{totalHabits}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[10px] text-[var(--color-text-tertiary)] text-center py-2 opacity-50">
                                                            No activity
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tasks Section - Only show in day view */}
                    {viewMode === 'day' && (
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
                                Tasks
                            </h3>
                            <div className="flex items-center gap-2">
                                {/* Filter Buttons */}
                                <div className="flex items-center gap-1 bg-[var(--color-muted)] rounded p-1">
                                    <button
                                        onClick={() => setTaskFilter('all')}
                                        className={`px-2 py-1 text-xs rounded transition-colors ${taskFilter === 'all'
                                            ? 'bg-[var(--color-primary)] text-white'
                                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                            }`}
                                    >
                                        All ({stats.total})
                                    </button>
                                    <button
                                        onClick={() => setTaskFilter('active')}
                                        className={`px-2 py-1 text-xs rounded transition-colors ${taskFilter === 'active'
                                            ? 'bg-[var(--color-primary)] text-white'
                                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                            }`}
                                    >
                                        Active ({stats.active})
                                    </button>
                                    <button
                                        onClick={() => setTaskFilter('completed')}
                                        className={`px-2 py-1 text-xs rounded transition-colors ${taskFilter === 'completed'
                                            ? 'bg-[var(--color-primary)] text-white'
                                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                            }`}
                                    >
                                        Done ({stats.done})
                                    </button>
                                    <button
                                        onClick={() => setTaskFilter('blocked')}
                                        className={`px-2 py-1 text-xs rounded transition-colors ${taskFilter === 'blocked'
                                            ? 'bg-[var(--color-primary)] text-white'
                                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                            }`}
                                    >
                                        Blocked ({stats.blocked})
                                    </button>
                                </div>
                                <button
                                    onClick={handleAddTask}
                                    className="px-3 py-1.5 text-xs bg-[var(--color-primary)] text-white rounded hover:opacity-90 transition-opacity flex items-center gap-1.5"
                                >
                                    <Icon name="Plus" className="w-3.5 h-3.5" />
                                    Add Task
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="text-center py-8 text-[var(--color-text-tertiary)] text-sm">Loading...</div>
                        ) : (
                            <>
                                {/* Active Tasks */}
                                {(taskFilter === 'all' || taskFilter === 'active') && (
                                    <div className="space-y-2 mb-3">
                                        {(taskFilter === 'all' ? activeTasks : filteredTasks.filter(t => t.status === 'todo' || t.status === 'in-progress')).map((task) => {
                                            const taskStatus = (task.status || (task.completed ? 'done' : 'todo')) as 'todo' | 'in-progress' | 'done' | 'blocked';
                                            return (
                                                <div
                                                    key={task.id}
                                                    className="bg-[var(--color-card)] border border-[var(--color-border)] rounded group transition-all"
                                                >
                                                    <div className="flex items-center gap-3 p-3">
                                                        <button
                                                            onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                                                            className="p-0.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors flex-shrink-0"
                                                            title={expandedTaskId === task.id ? 'Collapse' : 'Expand'}
                                                        >
                                                            <Icon
                                                                name={expandedTaskId === task.id ? "ChevronDown" : "ChevronRight"}
                                                                className="w-3.5 h-3.5"
                                                            />
                                                        </button>
                                                        <select
                                                            value={taskStatus}
                                                            onChange={async (e) => {
                                                                if (e.target.value === 'move-next-day') {
                                                                    await handleMoveTaskToNextDay(task.id);
                                                                    // Reset select to current status
                                                                    e.target.value = taskStatus;
                                                                    return;
                                                                }
                                                                const newStatus = e.target.value as 'todo' | 'in-progress' | 'done' | 'blocked';
                                                                // Update local state first with the new status
                                                                const updatedTasks = tasks.map(t =>
                                                                    t.id === task.id ? {
                                                                        ...t,
                                                                        status: newStatus,
                                                                        completed: newStatus === 'done'
                                                                    } : t
                                                                );
                                                                setTasks(updatedTasks);
                                                                // Auto-save status change with updated tasks
                                                                await saveTask(task.id, updatedTasks);
                                                            }}
                                                            className="px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)]"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <option value="todo">Todo</option>
                                                            <option value="in-progress">In Progress</option>
                                                            <option value="done">Done</option>
                                                            <option value="blocked">Blocked</option>
                                                            <option value="move-next-day" className="text-[var(--color-primary)] font-medium">→ Move to Next Day</option>
                                                        </select>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm">{getTaskIcon(task)}</span>
                                                                <input
                                                                    type="text"
                                                                    value={task.title}
                                                                    onChange={(e) => handleTaskUpdate(task.id, { title: e.target.value })}
                                                                    placeholder="New Task"
                                                                    className="flex-1 text-sm bg-transparent border-none outline-none text-[var(--color-text-primary)]"
                                                                />
                                                                {task.priority && (
                                                                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${getPriorityColor(task.priority)}`}>
                                                                        {getPriorityLabel(task.priority)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {expandedTaskId === task.id && (
                                                                <div className="mt-2 text-xs text-[var(--color-text-tertiary)]">
                                                                    {task.dependency && (
                                                                        <div className="flex items-center gap-1 mb-1">
                                                                            <span>Context:</span>
                                                                            <span className="text-[var(--color-text-secondary)]">{task.dependency}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {savedTaskId === task.id && (
                                                                <div className="text-[10px] text-green-500 mt-0.5 animate-fade-in">
                                                                    Saved successfully
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {focusTasks.includes(task.id) ? (
                                                                <button
                                                                    onClick={() => handleToggleFocus(task.id)}
                                                                    className="p-1 text-[var(--color-primary)] hover:text-[var(--color-primary)]/80"
                                                                    title="Remove from focus"
                                                                >
                                                                    <Icon name="Zap" className="w-3.5 h-3.5" />
                                                                </button>
                                                            ) : focusTasks.length < 3 ? (
                                                                <button
                                                                    onClick={() => handleToggleFocus(task.id)}
                                                                    className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)]"
                                                                    title="Add to focus"
                                                                >
                                                                    <Icon name="Zap" className="w-3.5 h-3.5" />
                                                                </button>
                                                            ) : null}
                                                            <button
                                                                onClick={() => saveTask(task.id)}
                                                                disabled={savingTaskId === task.id || loading}
                                                                className="p-1 text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 disabled:opacity-50"
                                                                title="Save task"
                                                            >
                                                                <Icon
                                                                    name={savingTaskId === task.id ? "RefreshCw" : "Save"}
                                                                    className={`w-3.5 h-3.5 ${savingTaskId === task.id ? 'animate-spin' : ''}`}
                                                                />
                                                            </button>
                                                            <button
                                                                onClick={() => handleTaskDelete(task.id)}
                                                                className="p-1 text-red-500 hover:text-red-600"
                                                                title="Delete task"
                                                            >
                                                                <Icon name="Trash2" className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Expanded task details */}
                                                    {expandedTaskId === task.id && (
                                                        <div className="px-3 pb-3 pt-0 border-t border-[var(--color-border)] mt-2 space-y-2">
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div>
                                                                    <label className="text-[10px] text-[var(--color-text-secondary)] mb-1 block">
                                                                        Priority
                                                                    </label>
                                                                    <select
                                                                        value={task.priority || 'P1'}
                                                                        onChange={(e) => handleTaskUpdate(task.id, { priority: e.target.value as 'P0' | 'P1' | 'P2' })}
                                                                        className="w-full px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)]"
                                                                    >
                                                                        <option value="P0">P0 - Critical</option>
                                                                        <option value="P1">P1 - High</option>
                                                                        <option value="P2">P2 - Medium</option>
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] text-[var(--color-text-secondary)] mb-1 block">
                                                                        Status
                                                                    </label>
                                                                    <select
                                                                        value={task.status || 'todo'}
                                                                        onChange={async (e) => {
                                                                            if (e.target.value === 'move-next-day') {
                                                                                await handleMoveTaskToNextDay(task.id);
                                                                                // Reset select to current status
                                                                                e.target.value = task.status || 'todo';
                                                                                return;
                                                                            }
                                                                            const newStatus = e.target.value as 'todo' | 'in-progress' | 'done' | 'blocked';
                                                                            // Update local state first with the new status
                                                                            const updatedTasks = tasks.map(t =>
                                                                                t.id === task.id ? {
                                                                                    ...t,
                                                                                    status: newStatus,
                                                                                    completed: newStatus === 'done'
                                                                                } : t
                                                                            );
                                                                            setTasks(updatedTasks);
                                                                            // Auto-save status change with updated tasks
                                                                            await saveTask(task.id, updatedTasks);
                                                                        }}
                                                                        className="w-full px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)]"
                                                                    >
                                                                        <option value="todo">Todo</option>
                                                                        <option value="in-progress">In Progress</option>
                                                                        <option value="done">Done</option>
                                                                        <option value="blocked">Blocked</option>
                                                                        <option value="move-next-day" className="text-[var(--color-primary)] font-medium">→ Move to Next Day</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div>
                                                                    <label className="text-[10px] text-[var(--color-text-secondary)] mb-1 block">
                                                                        Estimated Time (min)
                                                                    </label>
                                                                    <input
                                                                        type="number"
                                                                        value={task.estimatedTime || ''}
                                                                        onChange={(e) => handleTaskUpdate(task.id, { estimatedTime: parseInt(e.target.value) || undefined })}
                                                                        className="w-full px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)]"
                                                                        placeholder="30"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] text-[var(--color-text-secondary)] mb-1 block">
                                                                        Actual Time (min)
                                                                    </label>
                                                                    <input
                                                                        type="number"
                                                                        value={task.actualTime || ''}
                                                                        onChange={(e) => handleTaskUpdate(task.id, { actualTime: parseInt(e.target.value) || undefined })}
                                                                        className="w-full px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)]"
                                                                        placeholder="35"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] text-[var(--color-text-secondary)] mb-1 block">
                                                                    Dependency / Blocker
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={task.dependency || ''}
                                                                    onChange={(e) => handleTaskUpdate(task.id, { dependency: e.target.value })}
                                                                    className="w-full px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)]"
                                                                    placeholder="What's blocking this task?"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] text-[var(--color-text-secondary)] mb-1 block">
                                                                    Notes
                                                                </label>
                                                                <textarea
                                                                    value={task.notes || ''}
                                                                    onChange={(e) => handleTaskUpdate(task.id, { notes: e.target.value })}
                                                                    placeholder="Add task notes..."
                                                                    rows={2}
                                                                    className="w-full px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] resize-none"
                                                                />
                                                            </div>
                                                            <div className="flex justify-end pt-1">
                                                                <button
                                                                    onClick={() => saveTask(task.id)}
                                                                    disabled={savingTaskId === task.id || loading}
                                                                    className="px-3 py-1.5 text-xs bg-[var(--color-primary)] text-white rounded hover:opacity-90 transition-opacity flex items-center gap-1.5 disabled:opacity-50"
                                                                >
                                                                    <Icon
                                                                        name={savingTaskId === task.id ? "RefreshCw" : "Save"}
                                                                        className={`w-3 h-3 ${savingTaskId === task.id ? 'animate-spin' : ''}`}
                                                                    />
                                                                    {savingTaskId === task.id ? 'Saving...' : 'Save Task'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Completed Tasks - Collapsed by default */}
                                {(taskFilter === 'all' || taskFilter === 'completed') && completedTasks.length > 0 && (
                                    <div className="mt-3">
                                        <button
                                            onClick={() => setShowCompleted(!showCompleted)}
                                            className="flex items-center gap-2 w-full text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] py-2"
                                        >
                                            <Icon
                                                name={showCompleted ? "ChevronDown" : "ChevronRight"}
                                                className="w-3 h-3"
                                            />
                                            <span>✓ {completedTasks.length} tasks completed today</span>
                                        </button>
                                        {showCompleted && (
                                            <div className="space-y-2 mt-2">
                                                {completedTasks.map((task) => {
                                                    return (
                                                        <div
                                                            key={task.id}
                                                            className="rounded border border-[var(--color-border)] bg-[var(--color-card)] opacity-60 group transition-all"
                                                        >
                                                            <div className="flex items-center gap-3 p-3">
                                                                <span className="text-sm">{getTaskIcon(task)}</span>
                                                                <span className="flex-1 text-sm line-through text-[var(--color-text-tertiary)]">
                                                                    {task.title || 'Untitled task'}
                                                                </span>
                                                                {task.priority && (
                                                                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${getPriorityColor(task.priority)}`}>
                                                                        {getPriorityLabel(task.priority)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Blocked Tasks */}
                                {(taskFilter === 'blocked' || taskFilter === 'all') && (
                                    <div className="space-y-2 mb-3">
                                        {filteredTasks.filter(t => t.status === 'blocked').map((task) => {
                                            const taskStatus = (task.status || (task.completed ? 'done' : 'todo')) as 'todo' | 'in-progress' | 'done' | 'blocked';
                                            return (
                                                <div
                                                    key={task.id}
                                                    className="rounded border border-red-500/30 bg-[var(--color-card)] group transition-all"
                                                >
                                                    <div className="flex items-center gap-3 p-3">
                                                        <button
                                                            onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                                                            className="p-0.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors flex-shrink-0"
                                                            title={expandedTaskId === task.id ? 'Collapse' : 'Expand'}
                                                        >
                                                            <Icon
                                                                name={expandedTaskId === task.id ? "ChevronDown" : "ChevronRight"}
                                                                className="w-3.5 h-3.5"
                                                            />
                                                        </button>
                                                        <select
                                                            value={taskStatus}
                                                            onChange={async (e) => {
                                                                if (e.target.value === 'move-next-day') {
                                                                    await handleMoveTaskToNextDay(task.id);
                                                                    e.target.value = taskStatus;
                                                                    return;
                                                                }
                                                                const newStatus = e.target.value as 'todo' | 'in-progress' | 'done' | 'blocked';
                                                                const updatedTasks = tasks.map(t =>
                                                                    t.id === task.id ? {
                                                                        ...t,
                                                                        status: newStatus,
                                                                        completed: newStatus === 'done'
                                                                    } : t
                                                                );
                                                                setTasks(updatedTasks);
                                                                await saveTask(task.id, updatedTasks);
                                                            }}
                                                            className="px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)]"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <option value="todo">Todo</option>
                                                            <option value="in-progress">In Progress</option>
                                                            <option value="done">Done</option>
                                                            <option value="blocked">Blocked</option>
                                                            <option value="move-next-day" className="text-[var(--color-primary)] font-medium">→ Move to Next Day</option>
                                                        </select>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm">{getTaskIcon(task)}</span>
                                                                <input
                                                                    type="text"
                                                                    value={task.title}
                                                                    onChange={(e) => handleTaskUpdate(task.id, { title: e.target.value })}
                                                                    placeholder="New Task"
                                                                    className="flex-1 text-sm bg-transparent border-none outline-none text-[var(--color-text-primary)]"
                                                                />
                                                                {task.priority && (
                                                                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${getPriorityColor(task.priority)}`}>
                                                                        {getPriorityLabel(task.priority)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {expandedTaskId === task.id && (
                                                                <div className="mt-2 text-xs text-[var(--color-text-tertiary)]">
                                                                    {task.dependency && (
                                                                        <div className="flex items-center gap-1 mb-1">
                                                                            <span>Context:</span>
                                                                            <span className="text-[var(--color-text-secondary)]">{task.dependency}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {focusTasks.includes(task.id) ? (
                                                                <button
                                                                    onClick={() => handleToggleFocus(task.id)}
                                                                    className="p-1 text-[var(--color-primary)] hover:text-[var(--color-primary)]/80"
                                                                    title="Remove from focus"
                                                                >
                                                                    <Icon name="Zap" className="w-3.5 h-3.5" />
                                                                </button>
                                                            ) : focusTasks.length < 3 ? (
                                                                <button
                                                                    onClick={() => handleToggleFocus(task.id)}
                                                                    className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)]"
                                                                    title="Add to focus"
                                                                >
                                                                    <Icon name="Zap" className="w-3.5 h-3.5" />
                                                                </button>
                                                            ) : null}
                                                            <button
                                                                onClick={() => saveTask(task.id)}
                                                                disabled={savingTaskId === task.id || loading}
                                                                className="p-1 text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 disabled:opacity-50"
                                                                title="Save task"
                                                            >
                                                                <Icon
                                                                    name={savingTaskId === task.id ? "RefreshCw" : "Save"}
                                                                    className={`w-3.5 h-3.5 ${savingTaskId === task.id ? 'animate-spin' : ''}`}
                                                                />
                                                            </button>
                                                            <button
                                                                onClick={() => handleTaskDelete(task.id)}
                                                                className="p-1 text-red-500 hover:text-red-600"
                                                                title="Delete task"
                                                            >
                                                                <Icon name="Trash2" className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {expandedTaskId === task.id && (
                                                        <div className="px-3 pb-3 pt-0 border-t border-[var(--color-border)] mt-2 space-y-2">
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div>
                                                                    <label className="text-xs text-[var(--color-text-tertiary)] mb-1 block">Priority</label>
                                                                    <select
                                                                        value={task.priority || 'P1'}
                                                                        onChange={(e) => handleTaskUpdate(task.id, { priority: e.target.value as any })}
                                                                        className="w-full px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)]"
                                                                    >
                                                                        <option value="P0">P0 - Critical</option>
                                                                        <option value="P1">P1 - High</option>
                                                                        <option value="P2">P2 - Medium</option>
                                                                        <option value="low">Low</option>
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="text-xs text-[var(--color-text-tertiary)] mb-1 block">Estimated Time</label>
                                                                    <input
                                                                        type="text"
                                                                        value={task.estimatedTime || ''}
                                                                        onChange={(e) => handleTaskUpdate(task.id, { estimatedTime: e.target.value })}
                                                                        placeholder="e.g., 2h"
                                                                        className="w-full px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)]"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-[var(--color-text-tertiary)] mb-1 block">Context / Dependency</label>
                                                                <input
                                                                    type="text"
                                                                    value={task.dependency || ''}
                                                                    onChange={(e) => handleTaskUpdate(task.id, { dependency: e.target.value })}
                                                                    placeholder="What blocks this task?"
                                                                    className="w-full px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)]"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Empty State */}
                                {taskFilter === 'all' && activeTasks.length === 0 && completedTasks.length === 0 && filteredTasks.filter(t => t.status === 'blocked').length === 0 && (
                                    <div className="text-center py-8 text-[var(--color-text-tertiary)] text-sm">
                                        No tasks yet. Click "Add Task" to get started.
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    )}

                    {/* Scratchpad Section */}
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                            <Icon name="FileText" className="w-4 h-4" />
                            Notes / Scratchpad
                        </h3>
                        <textarea
                            value={scratchpad}
                            onChange={(e) => setScratchpad(e.target.value)}
                            onBlur={(e) => savePlannerData({ scratchpad: e.target.value })}
                            placeholder="Quick thoughts, copy-paste logs, links, IDs, meeting spillover notes..."
                            rows={6}
                            className="w-full px-3 py-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                        />
                    </div>

                    {/* End-of-Day Reflection Section - Collapsible */}
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4">
                        <button
                            onClick={() => setShowReflection(!showReflection)}
                            className="flex items-center gap-2 w-full text-sm font-semibold text-[var(--color-text-primary)] mb-0"
                        >
                            <Icon
                                name={showReflection ? "ChevronDown" : "ChevronRight"}
                                className="w-4 h-4"
                            />
                            <Icon name="PenTool" className="w-4 h-4" />
                            End-of-Day Reflection
                        </button>
                        {showReflection && (
                            <div className="space-y-3 mt-4">
                                <div>
                                    <label className="text-xs text-[var(--color-text-secondary)] mb-2 block">What went well?</label>
                                    <textarea
                                        value={reflection.whatWentWell || ''}
                                        onChange={(e) => setReflection({ ...reflection, whatWentWell: e.target.value })}
                                        onBlur={(e) => {
                                            const updatedReflection = { ...reflection, whatWentWell: e.target.value };
                                            setReflection(updatedReflection);
                                            savePlannerData({ reflection: updatedReflection });
                                        }}
                                        placeholder="What did you accomplish today?"
                                        rows={2}
                                        className="w-full px-3 py-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-[var(--color-text-secondary)] mb-2 block">What didn&apos;t?</label>
                                    <textarea
                                        value={reflection.whatDidnt || ''}
                                        onChange={(e) => setReflection({ ...reflection, whatDidnt: e.target.value })}
                                        onBlur={(e) => {
                                            const updatedReflection = { ...reflection, whatDidnt: e.target.value };
                                            setReflection(updatedReflection);
                                            savePlannerData({ reflection: updatedReflection });
                                        }}
                                        placeholder="What challenges did you face?"
                                        rows={2}
                                        className="w-full px-3 py-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-[var(--color-text-secondary)] mb-2 block">What blocked me?</label>
                                    <textarea
                                        value={reflection.whatBlocked || ''}
                                        onChange={(e) => setReflection({ ...reflection, whatBlocked: e.target.value })}
                                        onBlur={(e) => {
                                            const updatedReflection = { ...reflection, whatBlocked: e.target.value };
                                            setReflection(updatedReflection);
                                            savePlannerData({ reflection: updatedReflection });
                                        }}
                                        placeholder="What prevented you from completing tasks?"
                                        rows={2}
                                        className="w-full px-3 py-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-[var(--color-text-secondary)] mb-2 block">Carry-forward Tasks</label>
                                    <div className="flex flex-wrap gap-2">
                                        {reflection.carryForwardTasks?.map((task, index) => (
                                            <div key={index} className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-muted)] text-[var(--color-text-primary)] rounded border border-[var(--color-border)]">
                                                <span className="text-xs">{task}</span>
                                                <button
                                                    onClick={() => {
                                                        const newTasks = reflection.carryForwardTasks?.filter((_, i) => i !== index) || [];
                                                        const updatedReflection = { ...reflection, carryForwardTasks: newTasks };
                                                        setReflection(updatedReflection);
                                                        savePlannerData({ reflection: updatedReflection });
                                                    }}
                                                    className="text-[var(--color-text-secondary)] hover:text-red-500"
                                                >
                                                    <Icon name="X" className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                        <input
                                            type="text"
                                            placeholder="Add carry-forward task..."
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                    const newTasks = [...(reflection.carryForwardTasks || []), e.currentTarget.value.trim()];
                                                    const updatedReflection = { ...reflection, carryForwardTasks: newTasks };
                                                    setReflection(updatedReflection);
                                                    savePlannerData({ reflection: updatedReflection });
                                                    e.currentTarget.value = '';
                                                }
                                            }}
                                            className="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Habit Tracker - Moved to bottom and made collapsible */}
                    {viewMode === 'day' && (
                    <div className="bg-gradient-to-br from-[var(--color-card)] to-[var(--color-card)]/50 border border-[var(--color-border)] rounded-xl p-5 shadow-sm">
                        <button
                            onClick={() => setShowHabits(!showHabits)}
                            className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
                        >
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-[var(--color-primary)]/10 rounded-lg">
                                    <Icon name="CheckCircle" className="w-5 h-5 text-[var(--color-primary)]" />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Daily Habits</h3>
                                    <p className="text-xs text-[var(--color-text-tertiary)]">
                                        {habits.length > 0 ? `${habits.filter(h => h.completed).length}/${habits.length} completed` : 'Track your daily routines'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {habits.length > 0 && (
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            try {
                                                const newHabit: Habit = {
                                                    id: '', // Will be generated by backend
                                                    name: 'New Habit',
                                                    createdAt: new Date().toISOString()
                                                };
                                                const savedHabit = await saveHabit(newHabit);
                                                if (savedHabit && savedHabit.id) {
                                                    await loadHabitsForDate(selectedDate);
                                                    if ((window as any).showToast) {
                                                        (window as any).showToast('Habit created!', 'success');
                                                    }
                                                } else {
                                                    if ((window as any).showToast) {
                                                        (window as any).showToast('Failed to create habit', 'error');
                                                    }
                                                }
                                            } catch (error: any) {
                                                console.error('Failed to create habit:', error);
                                                if ((window as any).showToast) {
                                                    (window as any).showToast(`Error: ${error.message || 'Failed to create habit'}`, 'error');
                                                }
                                            }
                                        }}
                                        className="px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5 text-xs font-medium"
                                    >
                                        <Icon name="Plus" className="w-3.5 h-3.5" />
                                        Add
                                    </button>
                                )}
                                <Icon 
                                    name={showHabits ? "ChevronDown" : "ChevronRight"} 
                                    className="w-5 h-5 text-[var(--color-text-tertiary)]"
                                />
                            </div>
                        </button>
                        {showHabits && (
                        <div>
                        {habits.length === 0 ? (
                            <div className="text-center py-8">
                                <Icon name="CheckCircle" className="w-12 h-12 text-[var(--color-text-tertiary)]/30 mx-auto mb-3" />
                                <p className="text-sm text-[var(--color-text-tertiary)] mb-1">No habits yet</p>
                                <p className="text-xs text-[var(--color-text-tertiary)]">Add your first habit to start tracking your progress!</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {habits.map((habit) => (
                                    <div
                                        key={habit.id}
                                        className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-muted)]/50 transition-all group"
                                    >
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const wasCompleted = habit.completed;
                                                    const nowCompleted = !wasCompleted;
                                                    
                                                    // Save completion status to separate habits storage
                                                    await setHabitCompletion(habit.id, selectedDate, nowCompleted);
                                                    
                                                    // Reload habits to recalculate streaks and totals
                                                    await loadHabitsForDate(selectedDate);
                                                } catch (error: any) {
                                                    console.error('Failed to toggle habit:', error);
                                                    if ((window as any).showToast) {
                                                        (window as any).showToast('Failed to update habit', 'error');
                                                    }
                                                }
                                            }}
                                            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                                habit.completed
                                                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)] shadow-sm'
                                                    : 'border-[var(--color-border)] hover:border-[var(--color-primary)] bg-transparent'
                                            }`}
                                        >
                                            {habit.completed && <Icon name="Check" className="w-4 h-4 text-white" />}
                                        </button>
                                        <input
                                            type="text"
                                            value={habit.name}
                                            onChange={(e) => {
                                                const updatedHabits = habits.map(h =>
                                                    h.id === habit.id ? { ...h, name: e.target.value } : h
                                                );
                                                setHabits(updatedHabits);
                                            }}
                                            onBlur={async () => {
                                                try {
                                                    // Save habit name to separate storage
                                                    await saveHabit({ id: habit.id, name: habit.name });
                                                } catch (error: any) {
                                                    console.error('Failed to save habit name:', error);
                                                }
                                            }}
                                            className="flex-1 text-sm bg-transparent border-none outline-none text-[var(--color-text-primary)] font-medium"
                                            placeholder="Habit name"
                                        />
                                        <div className="flex items-center gap-2">
                                            {habit.streak && habit.streak > 0 && (
                                                <div className="flex items-center gap-1 px-2 py-1 bg-orange-500/10 text-orange-500 rounded-md text-xs font-medium">
                                                    <span>🔥</span>
                                                    <span>{habit.streak}</span>
                                                </div>
                                            )}
                                            {habit.totalCompletions !== undefined && habit.totalCompletions > 0 && (
                                                <div className="text-xs text-[var(--color-text-tertiary)]">
                                                    {habit.totalCompletions} done
                                                </div>
                                            )}
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await deleteHabit(habit.id);
                                                        // Reload habits after deletion
                                                        await loadHabitsForDate(selectedDate);
                                                        if ((window as any).showToast) {
                                                            (window as any).showToast('Habit deleted', 'success');
                                                        }
                                                    } catch (error: any) {
                                                        console.error('Failed to delete habit:', error);
                                                        if ((window as any).showToast) {
                                                            (window as any).showToast('Failed to delete habit', 'error');
                                                        }
                                                    }
                                                }}
                                                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 transition-opacity p-1"
                                            >
                                                <Icon name="Trash2" className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        </div>
                        )}
                    </div>
                    )}
                </div>
            </div>
        </div >
    );
}
