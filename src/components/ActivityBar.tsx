import type { WorkflowCategoryId } from "../utils/toolCategories";
import { WORKFLOW_CATEGORIES } from "../utils/toolCategories";

export type ActivityType = Exclude<WorkflowCategoryId, "home">;

interface ActivityBarProps {
  activeActivity: ActivityType;
  onActivityChange: (activity: ActivityType) => void;
}

interface Activity {
  id: ActivityType;
  label: string;
  icon: string;
  tooltip: string;
}

const activities: Activity[] = WORKFLOW_CATEGORIES.filter(
  (category): category is typeof category & { id: ActivityType } =>
    category.id !== "home",
).map((category) => ({
  id: category.id,
  label: category.title,
  icon:
    category.id === "build"
      ? "⚡"
      : category.id === "debug"
        ? "🔍"
        : category.id === "transform"
          ? "🔄"
          : category.id === "ship"
            ? "🚢"
            : category.id === "document"
              ? "📝"
              : "👤",
  tooltip: category.title,
}));

export function ActivityBar({ activeActivity, onActivityChange }: ActivityBarProps) {
  return (
    <div className="w-14 bg-[var(--color-background-soft)] border-r border-[var(--color-border)] flex flex-col items-center py-3 gap-2">
      {activities.map((activity) => {
        const isActive = activeActivity === activity.id;
        return (
          <button
            key={activity.id}
            onClick={() => onActivityChange(activity.id)}
            title={activity.tooltip}
            className={`
                            w-11 h-11 flex items-center justify-center rounded-md transition-colors duration-150
                            relative group
                            ${
                              isActive
                                ? "bg-[var(--color-primary)] text-white"
                                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-primary)]"
                            }
                        `}
          >
            <span className="text-xl">{activity.icon}</span>
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[var(--color-primary)] rounded-r" />
            )}
            <div className="absolute left-full ml-3 px-3 py-1.5 bg-[var(--color-text-primary)] text-[var(--color-background)] text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 border border-[var(--color-border)]">
              {activity.tooltip}
              <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-t-transparent border-r-4 border-r-[var(--color-text-primary)] border-b-4 border-b-transparent" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
