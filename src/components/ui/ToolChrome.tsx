import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { Icon } from "../Icon";

export type ToolSidebarWidth = "narrow" | "default" | "wide";

const sidebarWidthClass: Record<ToolSidebarWidth, string> = {
  narrow: "tool-sidebar--narrow",
  default: "tool-sidebar--default",
  wide: "tool-sidebar--wide",
};

/** Shared sidebar shell — Kube Lens nav pattern. */
export function toolSidebarClass(width: ToolSidebarWidth = "default", extra = "") {
  return `tool-sidebar custom-scrollbar ${sidebarWidthClass[width]}${extra ? ` ${extra}` : ""}`;
}

/** Nav/list row active state — left accent bar, subtle fill. */
export function toolSidebarItemClass(active: boolean, extra = "") {
  return `tool-sidebar-item${active ? " tool-sidebar-item-active" : ""}${extra ? ` ${extra}` : ""}`;
}

export function ToolSidebar({
  children,
  width = "default",
  className = "",
  style,
  ...props
}: HTMLAttributes<HTMLElement> & { width?: ToolSidebarWidth }) {
  return (
    <nav className={toolSidebarClass(width, className)} style={style} {...props}>
      {children}
    </nav>
  );
}

export function ToolSidebarHeader({
  title,
  actions,
  children,
  className = "",
}: {
  title?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`tool-sidebar-header ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2">
          {title && <span className="tool-sidebar-title">{title}</span>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function ToolSidebarBody({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`tool-sidebar-body ${className}`} {...props}>
      {children}
    </div>
  );
}

export function ToolSidebarSection({
  label,
  expanded,
  onToggle,
  count,
  className = "",
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  count?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={`tool-sidebar-section ${className}`}
    >
      <Icon
        name={expanded ? "ChevronDown" : "ChevronRight"}
        className="w-3 h-3 opacity-60 shrink-0"
      />
      <span className="truncate">{label}</span>
      {count !== undefined && (
        <span className="ml-auto text-[10px] tabular-nums opacity-70">{count}</span>
      )}
    </button>
  );
}

export function ToolSidebarItem({
  active,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      className={toolSidebarItemClass(!!active, className)}
      {...props}
    >
      {children}
    </button>
  );
}

/** Underline tab button class — matches Kube Lens dock/detail tabs. */
export function toolTabClass(active: boolean): string {
  return `py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
    active
      ? "border-[var(--color-primary)] text-[var(--color-text-primary)]"
      : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
  }`;
}

export function UnderlineTabs<T extends string>({
  tabs,
  active,
  onChange,
  className = "",
  borderless = false,
}: {
  tabs: readonly { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
  borderless?: boolean;
}) {
  return (
    <div
      className={`flex gap-3 ${borderless ? "" : "border-b border-[var(--color-border)]"} ${className}`}
    >
      {tabs.map((t) => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)} className={toolTabClass(active === t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Compact flat toolbar used across DevBench tools. */
export function ToolToolbar({
  title,
  children,
  actions,
  className = "",
}: {
  title?: string;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`tool-header ${className}`}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {title && (
          <span className="text-xs font-medium text-[var(--color-text-primary)] shrink-0">{title}</span>
        )}
        {children}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/** Editor pane label — uppercase, minimal. */
export function PaneLabel({ children }: { children: ReactNode }) {
  return (
    <div className="editor-pane-header text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
      {children}
    </div>
  );
}
