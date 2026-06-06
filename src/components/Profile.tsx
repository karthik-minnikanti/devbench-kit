import { GitSettings } from "./GitSettings";
import { AccountSettings } from "./AccountSettings";

export function Profile() {
  return (
    <div className="h-full flex flex-col bg-[var(--color-background)]">
      <div className="px-4 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-card)] flex-shrink-0">
        <span className="text-xs font-medium text-[var(--color-text-primary)]">Settings</span>
      </div>
      <div className="flex-1 overflow-auto">
        <AccountSettings />
        <GitSettings />
      </div>
    </div>
  );
}
