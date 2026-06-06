import { useState } from "react";
import { Icon } from "../Icon";
import { K8sResourceKind } from "./types";
import { NAV_SECTIONS } from "./utils";

interface K8sNavigatorProps {
  activeKind: K8sResourceKind;
  onSelect: (kind: K8sResourceKind) => void;
}

const KIND_ICONS: Record<
  K8sResourceKind,
  keyof typeof import("../Icons").Icons
> = {
  nodes: "Briefcase",
  namespaces: "Folder",
  pods: "Container",
  deployments: "FolderKanban",
  replicasets: "Copy",
  statefulsets: "File",
  daemonsets: "RefreshCw",
  jobs: "CheckSquare",
  cronjobs: "Clock",
  services: "Globe",
  ingresses: "Send",
  configmaps: "FileText",
  secrets: "Key",
  events: "Bell",
  timeline: "Clock",
  "dependency-graph": "Chart",
  search: "Search",
};

const DEFAULT_EXPANDED = NAV_SECTIONS.map((s) => s.id);

export function K8sNavigator({ activeKind, onSelect }: K8sNavigatorProps) {
  const [expandedSections, setExpandedSections] =
    useState<string[]>(DEFAULT_EXPANDED);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId],
    );
  };

  return (
    <nav className="w-56 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-background-soft)] overflow-y-auto custom-scrollbar flex flex-col">
      <div className="flex-1 py-2">
        {NAV_SECTIONS.map((section, sectionIndex) => {
          const isExpanded = expandedSections.includes(section.id);
          const sectionHasActive = section.items.some(
            (item) => item.kind === activeKind,
          );

          return (
            <div
              key={section.id}
              className={sectionIndex > 0 ? "mt-1 border-t border-[var(--color-border-soft)] pt-1" : ""}
            >
              {/* Section header — collapsible, not a resource link */}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                aria-expanded={isExpanded}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left select-none transition-colors ${
                  sectionHasActive && !isExpanded
                    ? "bg-[var(--color-muted)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]/60"
                }`}
              >
                <Icon
                  name={isExpanded ? "ChevronDown" : "ChevronRight"}
                  className="w-3.5 h-3.5 flex-shrink-0 opacity-70"
                />
                <span className="caption-uppercase flex-1 !text-[10px]">
                  {section.label}
                </span>
                {sectionHasActive && !isExpanded && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] flex-shrink-0" />
                )}
              </button>

              {/* Resource links — clearly interactive rows */}
              {isExpanded && (
                <ul className="px-2 pb-1 space-y-0.5" role="list">
                  {section.items.map((item) => {
                    const isActive = activeKind === item.kind;
                    return (
                      <li key={item.kind}>
                        <button
                          type="button"
                          onClick={() => onSelect(item.kind)}
                          aria-current={isActive ? "page" : undefined}
                          className={`group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-sm transition-all border ${
                            isActive
                              ? "bg-[var(--color-card)] border-[var(--color-border-strong)] text-[var(--color-text-primary)] font-medium shadow-none"
                              : "bg-transparent border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-card)] hover:border-[var(--color-border)] hover:text-[var(--color-text-primary)] cursor-pointer"
                          }`}
                        >
                          <span
                            className={`flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 border ${
                              isActive
                                ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]/25 text-[var(--color-primary)]"
                                : "bg-[var(--color-muted)] border-[var(--color-border-soft)] text-[var(--color-text-tertiary)] group-hover:border-[var(--color-border)] group-hover:text-[var(--color-text-secondary)]"
                            }`}
                          >
                            <Icon name={KIND_ICONS[item.kind]} size={14} />
                          </span>
                          <span className="flex-1 truncate">{item.label}</span>
                          <Icon
                            name="ChevronRight"
                            className={`w-3.5 h-3.5 flex-shrink-0 transition-opacity ${
                              isActive
                                ? "opacity-60 text-[var(--color-primary)]"
                                : "opacity-0 group-hover:opacity-50 text-[var(--color-text-tertiary)]"
                            }`}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
