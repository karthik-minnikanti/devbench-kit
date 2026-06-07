import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { Icon } from "../Icon";
import { TerminalAppearanceMenu } from "../terminal/TerminalAppearanceMenu";
import type { DevShellTab } from "../../state/devShellStore";
import { devShellKindClass, devShellKindLabel } from "../../utils/devShell";

interface DevShellTabBarProps {
  tabs: DevShellTab[];
  activeTabId: string | null;
  showHistory: boolean;
  onToggleHistory: () => void;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onReorder: (draggedId: string, targetId: string, position: "before" | "after") => void;
  onNewLocalTab: () => void;
  onOpenK8s: () => void;
  onOpenDocker: () => void;
  onRestart: () => void;
}

type DropPosition = "before" | "after";

function dropPositionFromEvent(event: DragEvent<HTMLElement>): DropPosition {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientX < rect.left + rect.width / 2 ? "before" : "after";
}

export function DevShellTabBar({
  tabs,
  activeTabId,
  showHistory,
  onToggleHistory,
  onSelect,
  onClose,
  onReorder,
  onNewLocalTab,
  onOpenK8s,
  onOpenDocker,
  onRestart,
}: DevShellTabBarProps) {
  const tabListRef = useRef<HTMLDivElement>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [dragTabId, setDragTabId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<DropPosition>("before");

  useEffect(() => {
    if (!newMenuOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (!newMenuRef.current?.contains(event.target as Node)) {
        setNewMenuOpen(false);
      }
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onDocClick);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [newMenuOpen]);

  const focusTab = useCallback(
    (index: number) => {
      const tab = tabs[index];
      if (!tab) return;
      onSelect(tab.id);
      const button = tabListRef.current?.querySelector<HTMLButtonElement>(
        `[data-tab-id="${tab.id}"]`,
      );
      button?.focus();
    },
    [onSelect, tabs],
  );

  const handleTabListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTabId);
    if (currentIndex === -1) return;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTab((currentIndex + 1) % tabs.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTab((currentIndex - 1 + tabs.length) % tabs.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab(tabs.length - 1);
    }
  };

  const pickNewTabOption = (action: () => void) => {
    setNewMenuOpen(false);
    action();
  };

  const clearDragState = () => {
    setDragTabId(null);
    setDropTargetId(null);
  };

  const handleTabDragStart = (tabId: string) => (event: DragEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".devshell-tab__close")) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", tabId);
    setDragTabId(tabId);
  };

  const handleTabDragOver = (tabId: string) => (event: DragEvent<HTMLDivElement>) => {
    if (!dragTabId || dragTabId === tabId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetId(tabId);
    setDropPosition(dropPositionFromEvent(event));
  };

  const handleTabDrop = (tabId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const draggedId = event.dataTransfer.getData("text/plain") || dragTabId;
    if (!draggedId || draggedId === tabId) {
      clearDragState();
      return;
    }

    onReorder(draggedId, tabId, dropPositionFromEvent(event));
    clearDragState();
  };

  return (
    <div className="devshell-header shrink-0">
      <button
        type="button"
        onClick={onToggleHistory}
        className={`devshell-header__panel-toggle ${showHistory ? "devshell-header__panel-toggle--active" : ""}`}
        aria-expanded={showHistory}
        aria-controls="devshell-session-panel"
        aria-label={showHistory ? "Hide session panel" : "Show session panel"}
        title={`${showHistory ? "Hide" : "Show"} session panel (⌘⇧H)`}
      >
        <Icon name={showHistory ? "ChevronLeft" : "Menu"} className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      <div className="devshell-header__tabs flex flex-1 min-w-0 items-end gap-0.5">
        <div
          ref={tabListRef}
          className="devshell-tabbar flex items-end gap-0.5 flex-1 min-w-0 overflow-x-auto"
          role="tablist"
          aria-label="DevShell sessions"
          onKeyDown={handleTabListKeyDown}
        >
          {tabs.map((tab) => {
            const active = tab.id === activeTabId;
            const isDragging = dragTabId === tab.id;
            const isDropTarget = dropTargetId === tab.id && dragTabId !== tab.id;
            return (
              <div
                key={tab.id}
                draggable
                onDragStart={handleTabDragStart(tab.id)}
                onDragEnd={clearDragState}
                onDragOver={handleTabDragOver(tab.id)}
                onDrop={handleTabDrop(tab.id)}
                className={`devshell-tab group ${devShellKindClass(tab.config.kind)} ${
                  active ? "devshell-tab--active" : ""
                } ${isDragging ? "devshell-tab--dragging" : ""} ${
                  isDropTarget && dropPosition === "before" ? "devshell-tab--drop-before" : ""
                } ${isDropTarget && dropPosition === "after" ? "devshell-tab--drop-after" : ""}`}
              >
                <button
                  type="button"
                  role="tab"
                  id={`devshell-tab-${tab.id}`}
                  data-tab-id={tab.id}
                  aria-selected={active}
                  aria-controls="devshell-terminal-panel"
                  tabIndex={active ? 0 : -1}
                  onClick={() => onSelect(tab.id)}
                  className="devshell-tab__button"
                  title={`${tab.title} — drag to reorder`}
                >
                  <span className="devshell-tab__kind">{devShellKindLabel(tab.config.kind)}</span>
                  <span className="devshell-tab__title">{tab.title}</span>
                </button>
                <button
                  type="button"
                  draggable={false}
                  onDragStart={(event) => event.preventDefault()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose(tab.id);
                  }}
                  className="devshell-tab__close"
                  title="Close tab"
                  aria-label={`Close ${tab.title}`}
                >
                  <Icon name="X" className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>

        <div ref={newMenuRef} className="devshell-tabbar-new shrink-0 flex items-end gap-0.5 mb-0.5">
          <button
            type="button"
            onClick={onNewLocalTab}
            className="devshell-tabbar__new"
            title="New local shell"
            aria-label="New local shell tab"
          >
            <Icon name="Plus" className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setNewMenuOpen((open) => !open)}
            className="devshell-tabbar__new-menu"
            title="More shell options"
            aria-label="More shell options"
            aria-expanded={newMenuOpen}
            aria-haspopup="menu"
          >
            <Icon name="ChevronDown" className="w-3 h-3" aria-hidden="true" />
          </button>

          {newMenuOpen && (
            <div
              className="devshell-new-menu"
              role="menu"
              aria-label="Remote shell options"
            >
              <button
                type="button"
                role="menuitem"
                className="devshell-new-menu__item"
                onClick={() => pickNewTabOption(onOpenK8s)}
              >
                <Icon name="Kubernetes" className="w-3.5 h-3.5 text-[#2563eb]" aria-hidden="true" />
                <span>
                  <span className="devshell-new-menu__label">From Kubernetes</span>
                  <span className="devshell-new-menu__hint">Pick a pod in Kube Lens</span>
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="devshell-new-menu__item"
                onClick={() => pickNewTabOption(onOpenDocker)}
              >
                <Icon name="Container" className="w-3.5 h-3.5 text-[#0891b2]" aria-hidden="true" />
                <span>
                  <span className="devshell-new-menu__label">From Docker</span>
                  <span className="devshell-new-menu__hint">Pick a container</span>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="devshell-header__actions shrink-0">
        <TerminalAppearanceMenu compact />
        <button
          type="button"
          onClick={onRestart}
          className="devshell-header__action"
          title="Restart active session"
          aria-label="Restart active session"
        >
          <Icon name="RefreshCw" className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
