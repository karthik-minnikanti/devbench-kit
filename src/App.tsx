import { useEffect, useState, useCallback } from 'react';
import { useStore } from './state/store';
import { JsonEditor } from './components/JsonEditor';
import { OutputTabs } from './components/OutputTabs';
import { SchemaOptions } from './components/SchemaOptions';
import { HistoryPanel } from './components/HistoryPanel';
import { JsonXmlConverter } from './components/JsonXmlConverter';
import { EncoderDecoder } from './components/EncoderDecoder';
import { ApiClient } from './components/ApiClient';
import { Formatter } from './components/Formatter';
import { JavaScriptRunner } from './components/JavaScriptRunner';
import { DockerContainer } from './components/DockerContainer';
import { Kubernetes } from './components/Kubernetes';
import { Notes } from './components/Notes';
import { ExcalidrawComponent } from './components/Excalidraw';
import { UmlEditor } from './components/UmlEditor';
import { TabType } from './components/CategorizedTabs';
import { JsonDiff } from './components/JsonDiff';
import { RegexTester } from './components/RegexTester';
import { CsvYamlConverter } from './components/CsvYamlConverter';
import { GlobalSearch } from './components/GlobalSearch';
import { Profile } from './components/Profile';
import { DailyPlanner } from './components/DailyPlanner';
import { Home } from './components/Home';
import { TopNavigationBar } from './components/TopNavigationBar';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { Icons } from './components/Icons';
import { BrandLogo } from './components/BrandLogo';
import { WelcomeScreen } from './components/WelcomeScreen';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { GitSetupDialog } from './components/GitSetupDialog';
import { GitSettings } from './components/GitSettings';

function App() {
    const loadConfig = useStore((state) => state.loadConfig);
    const loadHistory = useStore((state) => state.loadHistory);
    const setTheme = useStore((state) => state.setTheme);
    const config = useStore((state) => state.config);
    const [activeTab, setActiveTab] = useState<TabType>('home');
    const [isMac, setIsMac] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [showGitSetup, setShowGitSetup] = useState(false);
    const [gitRepoPath, setGitRepoPath] = useState<string | null>(null);

    useEffect(() => {
        // Always remove dark class on mount
        document.documentElement.classList.remove('dark');

        // Detect macOS for window controls spacing
        if (typeof window !== 'undefined' && window.navigator) {
            setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0 ||
                navigator.userAgent.toUpperCase().indexOf('MAC') >= 0);
        }

        loadConfig();
        loadHistory();
        checkGitSetup();

        // Offline queue sync removed - using Git-based storage now

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


    const checkGitSetup = async () => {
        try {
            const electronAPI = (window as any).electronAPI;
            if (electronAPI) {
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
            console.error('Failed to check Git setup:', error);
            setShowGitSetup(true);
        }
    };

    const handleGitSetupComplete = () => {
        setShowGitSetup(false);
        checkGitSetup();
    };

    useEffect(() => {
        // Always use light theme - remove dark class if present
        document.documentElement.classList.remove('dark');

        // If config has dark theme, reset it to light
        if (config?.theme === 'dark') {
            setTheme('light');
        }
    }, [config?.theme, setTheme]);

    // Allowed tabs: api, planner, js-runner, notes, excalidraw, uml (plus home)
    const ALLOWED_TABS: TabType[] = ['home', 'api', 'planner', 'js-runner', 'notes', 'excalidraw', 'uml'];

    // Define all tabs array with icon components (keeping all code, but filtering for display)
    const allTabs = [
        { id: 'home' as TabType, label: 'Home', icon: 'Home', description: 'Dashboard and quick access' },
        { id: 'schema' as TabType, label: 'Schema Generator', icon: 'Schema', description: 'Generate schemas from JSON' },
        { id: 'json-xml' as TabType, label: 'JSON/XML Converter', icon: 'Convert', description: 'Convert between JSON and XML' },
        { id: 'json-diff' as TabType, label: 'JSON Diff', icon: 'Diff', description: 'Compare two JSON objects' },
        { id: 'encoder' as TabType, label: 'Encoder/Decoder', icon: 'Lock', description: 'Encode and decode data' },
        { id: 'csv-yaml' as TabType, label: 'CSV/YAML Converter', icon: 'File', description: 'Convert CSV to YAML and vice versa' },
        { id: 'api' as TabType, label: 'API Client', icon: 'Globe', description: 'Test REST APIs' },
        { id: 'formatter' as TabType, label: 'Formatter', icon: 'Code', description: 'Format code and data' },
        { id: 'regex' as TabType, label: 'Regex Tester', icon: 'Search', description: 'Test regular expressions' },
        { id: 'js-runner' as TabType, label: 'JavaScript Runner', icon: 'Zap', description: 'Run JavaScript code' },
        { id: 'docker' as TabType, label: 'Docker', icon: 'Container', description: 'Manage Docker containers' },
        { id: 'k8s' as TabType, label: 'Kubernetes', icon: 'Kubernetes', description: 'Manage Kubernetes resources' },
        { id: 'notes' as TabType, label: 'Notes', icon: 'FileText', description: 'Take and organize notes' },
        { id: 'planner' as TabType, label: 'Daily Planner', icon: 'Calendar', description: 'Plan your day with tasks and notes' },
        { id: 'excalidraw' as TabType, label: 'Excalidraw', icon: 'Pen', description: 'Create diagrams' },
        { id: 'uml' as TabType, label: 'UML Editor', icon: 'Chart', description: 'Create UML diagrams' },
        { id: 'profile' as TabType, label: 'Profile', icon: 'User', description: 'Account settings' },
    ];

    // Filter tabs to only show allowed ones
    const tabs = allTabs.filter(tab => ALLOWED_TABS.includes(tab.id));

    const handleTabChange = useCallback((tabType: TabType) => {
        setActiveTab(tabType);
    }, []);

    // Check if user has seen welcome screen
    useEffect(() => {
        const hasSeenWelcome = localStorage.getItem('devbench_welcome_seen');
        if (!hasSeenWelcome) {
            setShowWelcome(true);
        }
    }, []);

    // Expose openTool globally for Home component
    useEffect(() => {
        (window as any).openTool = (toolId: string, options?: { itemId?: string; date?: string; addTask?: boolean }) => {
            const toolType = toolId as TabType;
            handleTabChange(toolType);
            // Store itemId for component to pick up
            if (options?.itemId) {
                (window as any).__pendingItemId = { toolType, itemId: options.itemId };
                // Clear after a short delay
                setTimeout(() => {
                    delete (window as any).__pendingItemId;
                }, 1000);
            }
            // Store date for planner to pick up
            if (options?.date) {
                (window as any).__pendingPlannerDate = options.date;
                // Clear after a short delay
                setTimeout(() => {
                    delete (window as any).__pendingPlannerDate;
                }, 2000);
            }
            // Store addTask flag for planner
            if (options?.addTask) {
                (window as any).__pendingAddTask = true;
                // Clear after a short delay
                setTimeout(() => {
                    delete (window as any).__pendingAddTask;
                }, 2000);
            }
        };
        return () => {
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
                            <JsonEditor />
                        </div>
                        <div className="flex-1 flex flex-col" style={{ minHeight: 0, minWidth: 0 }}>
                            <OutputTabs />
                        </div>
                    </div>
                );
            case 'json-xml':
                return <JsonXmlConverter />;
            case 'encoder':
                return <EncoderDecoder />;
            case 'api':
                return <ApiClient />;
            case 'formatter':
                return <Formatter />;
            case 'js-runner':
                return <JavaScriptRunner />;
            case 'docker':
                return <DockerContainer />;
            case 'k8s':
                return <Kubernetes />;
            case 'notes':
                return <Notes />;
            case 'planner':
                return <DailyPlanner />;
            case 'excalidraw':
                return <ExcalidrawComponent />;
            case 'uml':
                return <UmlEditor />;
            case 'json-diff':
                return <JsonDiff />;
            case 'regex':
                return <RegexTester />;
            case 'csv-yaml':
                return <CsvYamlConverter />;
            case 'profile':
                return <Profile />;
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

            {/* Main Layout: Editor + Secondary Sidebar */}
            <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
                {/* Editor Area */}
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-background)]" style={{ minHeight: 0 }}>
                    {/* Toolbar for Schema */}
                    {activeTab === 'schema' && (
                        <div className="h-11 bg-[var(--color-card)] border-b border-[var(--color-border)] flex items-center justify-between px-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <SchemaOptions />
                                <button
                                    onClick={() => setShowHistory(!showHistory)}
                                    className={`px-2.5 py-1 text-xs rounded transition-all flex items-center gap-1.5 ${showHistory
                                        ? 'bg-[var(--color-primary)] text-white'
                                        : 'text-[var(--color-text-secondary)] bg-[var(--color-muted)] hover:bg-[var(--color-border)]'
                                        }`}
                                >
                                    <span>{showHistory ? 'Hide' : 'History'}</span>
                                </button>
                            </div>
                        </div>
                    )}
                    {/* Content */}
                    <div className="flex-1 overflow-hidden bg-[var(--color-background)]" style={{ minHeight: 0 }}>
                        {renderContent()}
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
                        <HistoryPanel />
                    </Sidebar>
                )}
            </div>

            {/* Status Bar (Bottom) */}
            <StatusBar onShowShortcuts={() => setShowShortcuts(true)} />

            {/* Global Search */}
            <GlobalSearch />

            {/* Welcome Screen Overlay */}
            {showWelcome && (
                <div className="fixed inset-0 z-[9997]">
                    <WelcomeScreen
                        onDismiss={() => {
                            setShowWelcome(false);
                            localStorage.setItem('devbench_welcome_seen', 'true');
                        }}
                        onOpenTool={(tool) => {
                            const toolType = tool as TabType;
                            handleTabChange(toolType);
                            setShowWelcome(false);
                            localStorage.setItem('devbench_welcome_seen', 'true');
                        }}
                    />
                </div>
            )}

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
        </div>
    );
}

export default App;


