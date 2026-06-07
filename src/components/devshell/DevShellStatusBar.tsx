import type { DevShellTab } from "../../state/devShellStore";
import { devShellKindLabel } from "../../utils/devShell";
import { getTerminalScope } from "../../utils/terminalScope";

export type DevShellSessionStatus = "connecting" | "running" | "exited";

interface DevShellStatusBarProps {
  activeTab: DevShellTab;
  status: DevShellSessionStatus;
}

export function DevShellStatusBar({ activeTab, status }: DevShellStatusBarProps) {
  const scope = getTerminalScope(activeTab.config);
  const statusLabel =
    status === "running" ? "Connected" : status === "exited" ? "Exited" : "Connecting";
  const statusClass =
    status === "running"
      ? "devshell-statusbar__status--running"
      : status === "exited"
        ? "devshell-statusbar__status--exited"
        : "devshell-statusbar__status--connecting";

  return (
    <div className="devshell-statusbar shrink-0">
      <div className="devshell-statusbar__left">
        <span
          className={`devshell-statusbar__kind devshell-statusbar__kind--${activeTab.config.kind}`}
        >
          {devShellKindLabel(activeTab.config.kind)}
        </span>
        <span className="devshell-statusbar__scope truncate font-mono" title={scope}>
          {scope}
        </span>
      </div>

      <div className="devshell-statusbar__right">
        <span className={`devshell-statusbar__status ${statusClass}`}>{statusLabel}</span>
        <span className="devshell-statusbar__divider" />
        <span className="devshell-statusbar__hint">⌘⇧H panel</span>
      </div>
    </div>
  );
}
