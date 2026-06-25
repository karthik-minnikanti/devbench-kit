import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { getNotes, getDrawings, getPlannerEntry } from "../services/sync";
import { getHistory } from "../services/history";
import { BrandWatermark } from "./BrandLogo";
import { formatDateLocal } from "../utils/dateUtils";
import { appEvents, EVENTS, openTool } from "../utils/appEvents";
import { ToolToolbar, UnderlineTabs } from "./ui/ToolChrome";
import {
  HOME_TOOL_SECTIONS,
  type HomeToolSectionId,
} from "../utils/toolCategories";

type ContinueItem = {
  id: string;
  type: "note" | "drawing";
  title: string;
  timestamp: Date;
};

const TOOL_SECTIONS = HOME_TOOL_SECTIONS;
type ToolSectionId = HomeToolSectionId;

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function PanelHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-4 py-2.5 border-b border-[var(--color-border)] flex items-center justify-between gap-2">
      <h2 className="caption-uppercase !mb-0">{title}</h2>
      {action}
    </div>
  );
}

export function Home() {
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<ToolSectionId>("ship");
  const [continueItems, setContinueItems] = useState<ContinueItem[]>([]);
  const [todayTasks, setTodayTasks] = useState<any[]>([]);
  const [stats, setStats] = useState({
    history: 0,
    notes: 0,
    drawings: 0,
    tasksDone: 0,
    tasksTotal: 0,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { getElectronAPI } = await import("../utils/electronAPI");
      if (!getElectronAPI()) return;

      const [history, notes, drawings] = await Promise.all([
        getHistory().catch(() => []),
        getNotes().catch(() => []),
        getDrawings().catch(() => []),
      ]);

      const plannerEntry = await getPlannerEntry(formatDateLocal()).catch(
        () => null,
      );
      const tasks = plannerEntry?.tasks || [];

      const noteItems: ContinueItem[] = notes.map((note: any) => ({
        id: String(note.id || note._id || ""),
        type: "note" as const,
        title: note.title || "Untitled note",
        timestamp: new Date(note.updatedAt || note.createdAt),
      }));

      const drawingItems: ContinueItem[] = drawings.map((drawing: any) => ({
        id: String(drawing.id || drawing._id || ""),
        type: "drawing" as const,
        title: drawing.title || "Untitled drawing",
        timestamp: new Date(drawing.updatedAt || drawing.createdAt),
      }));

      setContinueItems(
        [...noteItems, ...drawingItems]
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 3),
      );
      setTodayTasks(tasks.filter((t: any) => !t.completed).slice(0, 3));
      setStats({
        history: history.length,
        notes: notes.length,
        drawings: drawings.length,
        tasksDone: tasks.filter((t: any) => t.completed).length,
        tasksTotal: tasks.length,
      });
    } catch (error) {
      console.error("[Home] Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    return appEvents.on(EVENTS.OPEN_TOOL, () => {
      setTimeout(() => loadData(), 500);
    });
  }, [loadData]);

  const now = new Date();
  const greeting = greetingForHour(now.getHours());
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const metrics = useMemo(
    () => [
      { label: "History", value: stats.history },
      { label: "Notes", value: stats.notes },
      { label: "Drawings", value: stats.drawings },
      {
        label: "Tasks today",
        value:
          stats.tasksTotal > 0 ? `${stats.tasksDone}/${stats.tasksTotal}` : "—",
      },
    ],
    [stats],
  );

  const activeTools =
    TOOL_SECTIONS.find((s) => s.id === activeSection)?.tools ?? [];

  const openContinue = (item: ContinueItem) => {
    openTool(item.type === "note" ? "notes" : "excalidraw", {
      itemId: item.id,
    });
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-background)] overflow-hidden">
      <ToolToolbar
        title="Home"
        actions={
          <button
            type="button"
            onClick={() => loadData()}
            disabled={loading}
            className="btn-secondary !h-7 !text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <Icon
              name="RefreshCw"
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        }
      >
        <span className="text-xs text-[var(--color-text-tertiary)] hidden sm:inline">
          {dateLabel}
        </span>
      </ToolToolbar>

      <div className="flex-1 overflow-y-auto custom-scrollbar relative min-h-0">
        <BrandWatermark className="fixed inset-0 flex items-center justify-center pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8 py-6 sm:py-8 space-y-6">
          {/* Overview band */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <section className="card p-5 flex flex-col justify-center lg:row-span-1">
              <h1 className="display-sm">{greeting}</h1>
              <p className="text-sm text-[var(--color-text-secondary)] mt-2">
                {dateLabel}
              </p>
            </section>

            <section className="card overflow-hidden flex flex-col min-h-[140px]">
              <PanelHeader
                title="Continue"
                action={
                  <span className="text-[10px] text-[var(--color-text-tertiary)]">
                    Notes & drawings
                  </span>
                }
              />
              {continueItems.length === 0 ? (
                <div className="flex-1 flex items-center justify-center px-4 py-6 text-xs text-[var(--color-text-tertiary)]">
                  Nothing recent yet
                </div>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {continueItems.map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      <button
                        type="button"
                        onClick={() => openContinue(item)}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-[var(--color-muted)]/60 transition-colors group"
                      >
                        <Icon
                          name={item.type === "note" ? "FileText" : "Pen"}
                          className="w-3.5 h-3.5 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-primary)] shrink-0"
                        />
                        <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-primary)]">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-[var(--color-text-tertiary)] shrink-0">
                          {formatTimeAgo(item.timestamp)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card overflow-hidden flex flex-col min-h-[140px]">
              <PanelHeader
                title="Today"
                action={
                  <button
                    type="button"
                    onClick={() =>
                      openTool("planner", { date: formatDateLocal() })
                    }
                    className="text-[10px] text-[var(--color-primary)] hover:underline"
                  >
                    Planner
                  </button>
                }
              />
              {todayTasks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 py-4">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    No open tasks
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      openTool("planner", {
                        date: formatDateLocal(),
                        addTask: true,
                      })
                    }
                    className="btn-primary !h-7 !text-xs"
                  >
                    Add task
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {todayTasks.map((task) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() =>
                          openTool("planner", {
                            date: formatDateLocal(),
                            taskId: String(task.id),
                          })
                        }
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-[var(--color-muted)]/60 transition-colors group"
                      >
                        <div className="w-3 h-3 rounded-sm border border-[var(--color-border)] shrink-0 group-hover:border-[var(--color-primary)]" />
                        <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-primary)]">
                          {task.title || "Untitled task"}
                        </span>
                        {task.time && (
                          <span className="text-[10px] text-[var(--color-text-tertiary)] shrink-0">
                            {task.time}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Metrics strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--color-border)] border border-[var(--color-border)] rounded-lg overflow-hidden">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="bg-[var(--color-card)] px-4 py-3 flex flex-col gap-0.5"
              >
                <span className="caption-uppercase !text-[10px]">
                  {metric.label}
                </span>
                <span className="text-lg font-mono font-medium text-[var(--color-text-primary)] tabular-nums leading-none">
                  {loading ? "—" : metric.value}
                </span>
              </div>
            ))}
          </div>

          {/* Tools */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="title-sm">Open a tool</h2>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                  Browse by workflow — top navigation still lists every tool by name
                </p>
              </div>
            </div>

            <UnderlineTabs
              className="mb-4 flex-wrap gap-x-4"
              tabs={TOOL_SECTIONS.map((s) => ({
                id: s.id,
                label: s.title,
              }))}
              active={activeSection}
              onChange={setActiveSection}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {activeTools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => openTool(tool.id)}
                  className={`card p-4 text-left transition-colors hover:border-[var(--color-border-strong)] group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${
                    tool.id === "devshell" ? "devshell-tool-tile--featured" : ""
                  }`}
                  aria-label={`Open ${tool.label}. ${tool.description}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                        tool.id === "devshell"
                          ? "bg-[var(--color-primary)]/15 group-hover:bg-[var(--color-primary)]/20"
                          : "bg-[var(--color-muted)] group-hover:bg-[var(--color-primary)]/10"
                      }`}
                    >
                      <Icon
                        name={tool.icon}
                        className={`w-4 h-4 ${
                          tool.id === "devshell"
                            ? "text-[var(--color-primary)]"
                            : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)]"
                        }`}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug flex items-center gap-2">
                        {tool.label}
                        {tool.id === "devshell" && (
                          <span className="devshell-featured-badge">Featured</span>
                        )}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-1 leading-relaxed">
                        {tool.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
