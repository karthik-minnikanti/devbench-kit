import type { TerminalSessionConfig } from "../components/TerminalView";
import { appEvents, EVENTS, openTool } from "./appEvents";
import {
  ensureDevShellInitialized,
  useDevShellStore,
} from "../state/devShellStore";

export interface OpenDevShellOptions {
  activate?: boolean;
  reuseExisting?: boolean;
  navigate?: boolean;
}

export function openDevShell(
  config: TerminalSessionConfig,
  options: OpenDevShellOptions = {},
): string {
  const { activate = true, reuseExisting = true, navigate = true } = options;

  ensureDevShellInitialized();
  const tabId = useDevShellStore
    .getState()
    .openSession(config, { activate, reuseExisting });

  appEvents.emit(EVENTS.OPEN_DEVSHELL, { config, tabId });

  if (navigate) {
    openTool("devshell");
  }

  return tabId;
}

export function openLocalDevShell(options?: OpenDevShellOptions): string {
  return openDevShell({ kind: "local" }, options);
}

export function setDevShellPanelOpen(open: boolean): void {
  useDevShellStore.getState().setShowHistory(open);
}

export function toggleDevShellPanel(): void {
  useDevShellStore.getState().toggleHistory();
}

export type DevShellKind = TerminalSessionConfig["kind"];

export function devShellKindLabel(kind: DevShellKind): string {
  switch (kind) {
    case "k8s":
      return "K8s";
    case "docker":
      return "Docker";
    default:
      return "Local";
  }
}

export function devShellKindClass(kind: DevShellKind): string {
  switch (kind) {
    case "k8s":
      return "devshell-tab--k8s";
    case "docker":
      return "devshell-tab--docker";
    default:
      return "devshell-tab--local";
  }
}
