const DEVSHELL_PANEL_OPEN_KEY = "devbench-devshell-panel-open";

export function readDevShellPanelOpen(): boolean {
  try {
    const value = localStorage.getItem(DEVSHELL_PANEL_OPEN_KEY);
    if (value === "true") return true;
    if (value === "false") return false;
  } catch {
    /* ignore storage errors */
  }
  return false;
}

export function persistDevShellPanelOpen(open: boolean): void {
  try {
    localStorage.setItem(DEVSHELL_PANEL_OPEN_KEY, String(open));
  } catch {
    /* ignore storage errors */
  }
}

const DEVSHELL_WELCOME_SEEN_KEY = "devbench-devshell-welcome-seen";

export function readDevShellWelcomeSeen(): boolean {
  try {
    if (localStorage.getItem(DEVSHELL_WELCOME_SEEN_KEY) === "true") return true;
    // Existing users already persisted panel preference before welcome was added
    if (localStorage.getItem(DEVSHELL_PANEL_OPEN_KEY) !== null) return true;
  } catch {
    return false;
  }
  return false;
}

export function persistDevShellWelcomeSeen(): void {
  try {
    localStorage.setItem(DEVSHELL_WELCOME_SEEN_KEY, "true");
  } catch {
    /* ignore storage errors */
  }
}
