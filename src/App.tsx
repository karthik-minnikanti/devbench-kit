import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useStore } from './state/store';
import { TabType } from './components/CategorizedTabs';
import { TopNavigationBar } from './components/TopNavigationBar';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { GitSetupDialog } from './components/GitSetupDialog';
import { GitSettings } from './components/GitSettings';
import { UpdateNotification } from './components/UpdateNotification';
import { ArchMismatchBanner } from './components/ArchMismatchBanner';
import { getElectronAPI } from './utils/electronAPI';
import { appEvents, EVENTS, openTool as emitOpenTool } from './utils/appEvents';
import { handleError } from './utils/errorHandler';
import { PROFILE_SECTION_ENABLED } from './utils/toolCategories';

// Lazy load heavy components for code splitting
const JsonEditor = lazy(() => import('./components/JsonEditor').then(m => ({ default: m.JsonEditor })));
const OutputTabs = lazy(() => import('./components/OutputTabs').then(m => ({ default: m.OutputTabs })));
const SchemaOptions = lazy(() => import('./components/SchemaOptions').then(m => ({ default: m.SchemaOptions })));
const HistoryPanel = lazy(() => import('./components/HistoryPanel').then(m => ({ default: m.HistoryPanel })));
const JsonXmlConverter = lazy(() => import('./components/JsonXmlConverter').then(m => ({ default: m.JsonXmlConverter })));
const EncoderDecoder = lazy(() => import('./components/EncoderDecoder').then(m => ({ default: m.EncoderDecoder })));
const ApiClient = lazy(() => import('./components/ApiClient').then(m => ({ default: m.ApiClient })));
const Formatter = lazy(() => import('./components/Formatter').then(m => ({ default: m.Formatter })));
const JavaScriptRunner = lazy(() => import('./components/JavaScriptRunner').then(m => ({ default: m.JavaScriptRunner })));
const DockerContainer = lazy(() => import('./components/DockerContainer').then(m => ({ default: m.DockerContainer })));
const Kubernetes = lazy(() => import('./components/Kubernetes').then(m => ({ default: m.Kubernetes })));
const Notes = lazy(() => import('./components/Notes').then(m => ({ default: m.Notes })));
const ExcalidrawComponent = lazy(() => import('./components/Excalidraw').then(m => ({ default: m.ExcalidrawComponent })));
const UmlEditor = lazy(() => import('./components/UmlEditor').then(m => ({ default: m.UmlEditor })));
const JsonDiff = lazy(() => import('./components/JsonDiff').then(m => ({ default: m.JsonDiff })));
const RegexTester = lazy(() => import('./components/RegexTester').then(m => ({ default: m.RegexTester })));
const CsvYamlConverter = lazy(() => import('./components/CsvYamlConverter').then(m => ({ default: m.CsvYamlConverter })));
const GlobalSearch = lazy(() => import('./components/GlobalSearch').then(m => ({ default: m.GlobalSearch })));
const DailyPlanner = lazy(() => import('./components/DailyPlanner').then(m => ({ default: m.DailyPlanner })));
const DevShell = lazy(() => import('./components/devshell/DevShell').then(m => ({ default: m.DevShell })));
// Home is the default view, so import it directly (not lazy) to avoid loading delays
import { Home } from './components/Home';

// Loading component for suspense fallback
const ComponentLoader = () => {
    console.log('[App] ComponentLoader rendered (lazy loading in progress)');
    return (
        <div className="flex items-center justify-center h-full">
            <div className="text-[var(--color-text-secondary)]">Loading...</div>
        </div>
    );
};

function App() {
    const loadConfig = useStore((state) => state.loadConfig);
    const loadHistory = useStore((state) => state.loadHistory);
    const config = useStore((state) => state.config);
    const [activeTab, setActiveTab] = useState<TabType>('home');
    const [isMac, setIsMac] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [showGitSetup, setShowGitSetup] = useState(false);
    const [gitRepoPath, setGitRepoPath] = useState<string | null>(null);
    const [pendingItemNav, setPendingItemNav] = useState<{
        toolType: TabType;
        itemId: string;
    } | null>(null);
    const [pendingPlannerNav, setPendingPlannerNav] = useState<{
        date?: string;
        taskId?: string;
        addTask?: boolean;
    } | null>(null);

    useEffect(() => {
        // Detect macOS for window controls spacing
        if (typeof window !== 'undefined' && window.navigator) {
            setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0 ||
                navigator.userAgent.toUpperCase().indexOf('MAC') >= 0);
        }

        loadConfig();
        loadHistory();
        checkGitSetup();

        // Keyboard shortcuts
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd/Ctrl + / to show keyboard shortcuts
            if ((e.metaKey || e.ctrlKey) && e.key === '/') {
                e.preventDefault();
                setShowShortcuts(true);
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [loadConfig, loadHistory]);


    const checkGitSetup = useCallback(async () => {
        try {
            const electronAPI = getElectronAPI();
            if (electronAPI?.git) {
                const result = await electronAPI.git.getRepoPath();
                if (result.success && result.repoPath) {
                    setGitRepoPath(result.repoPath);
                } else {
                    setShowGitSetup(true);
                }
            } else {
                setShowGitSetup(true);
            }
        } catch (error) {
            handleError(error, {
                message: 'Failed to check Git setup',
                showToast: false, // Don't show toast for setup checks
                context: { component: 'App', action: 'checkGitSetup' },
            });
            setShowGitSetup(true);
        }
    }, []);

    const handleGitSetupComplete = () => {
        setShowGitSetup(false);
        checkGitSetup();
    };

    // Apply saved theme to document root (Tailwind darkMode: 'class')
    useEffect(() => {
        const theme = config?.theme ?? 'light';
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [config?.theme]);

    // Allowed tabs visible in navigation
    const ALLOWED_TABS: TabType[] = ['home', 'api', 'planner', 'js-runner', 'notes', 'excalidraw', 'uml', 'k8s', 'devshell'];

    // Define all tabs array with icon components (keeping all code, but filtering for display)
    const allTabs = [
        { id: 'home' as TabType, label: 'Home', icon: 'Home', description: 'Dashboard and quick access' },
        { id: 'schema' as TabType, label: 'Schema Generator', icon: 'Schema', description: 'Generate schemas from JSON' },
        { id: 'json-xml' as TabType, label: 'JSON/XML Converter', icon: 'Convert', description: 'Convert between JSON and XML' },
        { id: 'json-diff' as TabType, label: 'JSON Diff', icon: 'Diff', description: 'Compare two JSON objects' },
        { id: 'encoder' as TabType, label: 'Encoder/Decoder', icon: 'Lock', description: 'Encode and decode data' },
        { id: 'csv-yaml' as TabType, label: 'CSV/YAML Converter', icon: 'File', description: 'Convert CSV to YAML and vice versa' },
        { id: 'api' as TabType, label: 'API Studio', icon: 'Globe', description: 'Test REST APIs' },
        { id: 'formatter' as TabType, label: 'Formatter', icon: 'Code', description: 'Format code and data' },
        { id: 'regex' as TabType, label: 'Regex Tester', icon: 'Search', description: 'Test regular expressions' },
        { id: 'js-runner' as TabType, label: 'JavaScript Runner', icon: 'Zap', description: 'Run JavaScript code' },
        { id: 'docker' as TabType, label: 'Docker', icon: 'Container', description: 'Manage Docker containers' },
        { id: 'k8s' as TabType, label: 'Kube Lens', icon: 'Kubernetes', description: 'Browse and manage Kubernetes clusters' },
        { id: 'devshell' as TabType, label: 'DevShell', icon: 'Terminal', description: 'Chrome-style tabs for local, K8s, and Docker shells' },
        { id: 'terminal' as TabType, label: 'DevShell', icon: 'Terminal', description: 'Chrome-style tabs for local, K8s, and Docker shells' },
        { id: 'notes' as TabType, label: 'Notes', icon: 'FileText', description: 'Take and organize notes' },
        { id: 'planner' as TabType, label: 'Daily Planner', icon: 'Calendar', description: 'Plan your day with tasks and notes' },
        { id: 'excalidraw' as TabType, label: 'Excalidraw', icon: 'Pen', description: 'Create diagrams' },
        { id: 'uml' as TabType, label: 'UML Editor', icon: 'Chart', description: 'Create UML diagrams' },
        { id: 'profile' as TabType, label: 'Profile', icon: 'User', description: 'Account settings' },
    ];

    // Filter tabs to only show allowed ones
    const tabs = allTabs.filter(tab => ALLOWED_TABS.includes(tab.id));

    const handleTabChange = useCallback((tabType: TabType) => {
        const normalized = tabType === 'terminal' ? 'devshell' : tabType;
        if (normalized === 'profile' && !PROFILE_SECTION_ENABLED) {
            setActiveTab('home');
            return;
        }
        setActiveTab(normalized);
    }, []);

    // Set up event listeners for tool navigation
    useEffect(() => {
        const unsubscribeOpenTool = appEvents.on(EVENTS.OPEN_TOOL, ({ toolId, options }) => {
            const normalizedToolId = toolId === 'terminal' ? 'devshell' : toolId;
            const toolType = normalizedToolId as TabType;
            handleTabChange(toolType);

            if (options?.itemId) {
                setPendingItemNav({ toolType, itemId: options.itemId });
                appEvents.emit(EVENTS.PENDING_ITEM_ID, { toolType, itemId: options.itemId });
            }
            if (toolType === 'planner' && (options?.date || options?.taskId || options?.addTask)) {
                setPendingPlannerNav({
                    date: options.date,
                    taskId: options.taskId,
                    addTask: options.addTask,
                });
            }
            if (options?.date) {
                appEvents.emit(EVENTS.PENDING_PLANNER_DATE, options.date);
            }
            if (options?.addTask) {
                appEvents.emit(EVENTS.PENDING_ADD_TASK, true);
            }
        });

        // Expose openTool globally for backward compatibility
        (window as any).openTool = emitOpenTool;

        return () => {
            unsubscribeOpenTool();
            delete (window as any).openTool;
        };
    }, [handleTabChange]);

    const renderContent = () => {
        switch (activeTab) {
            case 'home':
                return <Home />;
            case 'schema':
                return (
                    <div className="flex-1 flex overflow-hidden h-full" style={{ minHeight: 0 }}>
                        <div className="flex-1 flex flex-col border-r border-[var(--color-border)]" style={{ minHeight: 0, minWidth: 0 }}>
                            <Suspense fallback={<ComponentLoader />}>
                                <JsonEditor />
                            </Suspense>
                        </div>
                        <div className="flex-1 flex flex-col" style={{ minHeight: 0, minWidth: 0 }}>
                            <Suspense fallback={<ComponentLoader />}>
                                <OutputTabs />
                            </Suspense>
                        </div>
                    </div>
                );
            case 'json-xml':
                return (
                    <Suspense fallback={<ComponentLoader />}>
                        <JsonXmlConverter />
                    </Suspense>
                );
            case 'encoder':
                return (
                    <Suspense fallback={<ComponentLoader />}>
                        <EncoderDecoder />
                    </Suspense>
                );
            case 'api':
                return (
                    <Suspense fallback={<ComponentLoader />}>
                        <ApiClient />
                    </Suspense>
                );
            case 'formatter':
                return (
                    <Suspense fallback={<ComponentLoader />}>
                        <Formatter />
                    </Suspense>
                );
            case 'js-runner':
                return (
                    <Suspense fallback={<ComponentLoader />}>
                        <JavaScriptRunner />
                    </Suspense>
                );
            case 'docker':
                return (
                    <Suspense fallback={<ComponentLoader />}>
                        <DockerContainer />
                    </Suspense>
                );
            case 'k8s':
                return (
                    <Suspense fallback={<ComponentLoader />}>
                        <Kubernetes />
                    </Suspense>
                );
            case 'devshell':
            case 'terminal':
                return (
                    <Suspense fallback={<ComponentLoader />}>
                        <DevShell />
                    </Suspense>
                );
            case 'notes':
                return null;
            case 'planner':
                return (
                    <Suspense fallback={<ComponentLoader />}>
                        <DailyPlanner
                            pendingDate={pendingPlannerNav?.date}
                            pendingTaskId={pendingPlannerNav?.taskId}
                            pendingAddTask={pendingPlannerNav?.addTask}
                            onPendingHandled={() => setPendingPlannerNav(null)}
                        />
                    </Suspense>
                );
            case 'excalidraw':
                return (
                    <Suspense fallback={<ComponentLoader />}>
                        <ExcalidrawComponent
                            pendingItemId={
                                pendingItemNav?.toolType === 'excalidraw'
                                    ? pendingItemNav.itemId
                                    : undefined
                            }
                            onPendingItemHandled={() => setPendingItemNav(null)}
                        />
                    </Suspense>
                );
            case 'uml':
                return (
                    <Suspense fallback={<ComponentLoader />}>
                        <UmlEditor />
                    </Suspense>
                );
            case 'json-diff':
                return (
                    <Suspense fallback={<ComponentLoader />}>
                        <JsonDiff />
                    </Suspense>
                );
            case 'regex':
                return (
                    <Suspense fallback={<ComponentLoader />}>
                        <RegexTester />
                    </Suspense>
                );
            case 'csv-yaml':
                return (
                    <Suspense fallback={<ComponentLoader />}>
                        <CsvYamlConverter />
                    </Suspense>
                );
            case 'profile':
                return <Home />;
            case 'git-settings':
                return <GitSettings />;
            default:
                return <Home />;
        }
    };

    return (
        <div className="h-screen flex flex-col bg-[var(--color-background)] overflow-hidden relative" style={{ zIndex: 1 }}>
            {/* Top Navigation Bar */}
            <TopNavigationBar
                openTabs={[]}
                onTabClick={handleTabChange}
                onNewTab={handleTabChange}
                isMac={isMac}
            />

            <ArchMismatchBanner />

            {/* Main Layout: Editor + Secondary Sidebar */}
            <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
                {/* Editor Area */}
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-background)]" style={{ minHeight: 0 }}>
                    {/* Toolbar for Schema */}
                    {activeTab === 'schema' && (
                        <div className="tool-header">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Suspense fallback={null}>
                                    <SchemaOptions />
                                </Suspense>
                                <button
                                    onClick={() => setShowHistory(!showHistory)}
                                    className={`btn-secondary !h-7 !text-xs ${showHistory ? '!bg-[var(--color-primary)] !text-white !border-transparent' : ''}`}
                                >
                                    {showHistory ? 'Hide history' : 'History'}
                                </button>
                            </div>
                        </div>
                    )}
                    {/* Content */}
                    <div className="flex-1 overflow-hidden bg-[var(--color-background)] relative" style={{ minHeight: 0 }}>
                        {renderContent()}
                        <div
                            className={
                                activeTab === 'notes'
                                    ? 'absolute inset-0 flex flex-col min-h-0'
                                    : 'hidden'
                            }
                            aria-hidden={activeTab !== 'notes'}
                        >
                            <Suspense fallback={<ComponentLoader />}>
                                <Notes
                                    pendingItemId={
                                        pendingItemNav?.toolType === 'notes'
                                            ? pendingItemNav.itemId
                                            : undefined
                                    }
                                    onPendingItemHandled={() => setPendingItemNav(null)}
                                />
                            </Suspense>
                        </div>
                    </div>
                </div>

                {/* Secondary Sidebar (History, etc.) */}
                    {activeTab === 'schema' && showHistory && (
                    <Sidebar
                        isOpen={showHistory}
                        onClose={() => setShowHistory(false)}
                        title="History"
                        width={320}
                    >
                        <Suspense fallback={<ComponentLoader />}>
                            <HistoryPanel />
                        </Suspense>
                    </Sidebar>
                )}
            </div>

            {/* Status Bar (Bottom) */}
            <StatusBar onShowShortcuts={() => setShowShortcuts(true)} />

            {/* Global Search */}
            <Suspense fallback={null}>
                <GlobalSearch />
            </Suspense>

            {/* Keyboard Shortcuts */}
            <KeyboardShortcuts
                isOpen={showShortcuts}
                onClose={() => setShowShortcuts(false)}
            />

            {/* Git Setup Dialog */}
            <GitSetupDialog
                isOpen={showGitSetup}
                onClose={() => setShowGitSetup(false)}
                onComplete={handleGitSetupComplete}
            />

            {/* Update Notification */}
            <UpdateNotification />
        </div>
    );
}

export default App;


