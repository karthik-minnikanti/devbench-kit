import { ReactNode } from "react";
import { ActivityType } from "./ActivityBar";
import { getTabIdsForCategory, WORKFLOW_CATEGORIES } from "../utils/toolCategories";

interface PrimarySidebarProps {
  activeActivity: ActivityType;
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabs: Array<{ id: string; label: string; icon: string }>;
  children?: ReactNode;
}

export function PrimarySidebar({
  activeActivity,
  activeTab,
  onTabChange,
  tabs,
  children,
}: PrimarySidebarProps) {
  const allowedTabIds = getTabIdsForCategory(activeActivity);
  const filteredTabs = tabs.filter((tab) => allowedTabIds.includes(tab.id as never));

  const activeTitle =
    WORKFLOW_CATEGORIES.find((category) => category.id === activeActivity)?.title ??
    "Tools";

  return (
    <div className="w-56 bg-[var(--color-card)] border-r border-[var(--color-border)] flex flex-col h-full">
      <div className="h-12 flex items-center px-4 border-b border-[var(--color-border)] bg-[var(--color-background-soft)]">
        <h2 className="caption-uppercase">{activeTitle}</h2>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="py-2">
          {filteredTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                                    w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors
                                    ${
                                      isActive
                                        ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-l-2 border-[var(--color-primary)] font-medium"
                                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-primary)]"
                                    }
                                `}
              >
                <span className="text-lg">{tab.icon}</span>
                <span className="flex-1">{tab.label}</span>
              </button>
            );
          })}
        </div>
        {children && (
          <div className="border-t border-[var(--color-border)] mt-2">{children}</div>
        )}
      </div>
    </div>
  );
}
