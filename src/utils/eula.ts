import { EULA_VERSION } from "../content/eula";

const EULA_ACCEPTED_KEY = "devbench:eula-accepted";
const EULA_VERSION_KEY = "devbench:eula-version";

export function isEulaAccepted(): boolean {
  try {
    return (
      localStorage.getItem(EULA_ACCEPTED_KEY) === "true" &&
      localStorage.getItem(EULA_VERSION_KEY) === EULA_VERSION
    );
  } catch {
    return false;
  }
}

export function acceptEula(): void {
  localStorage.setItem(EULA_ACCEPTED_KEY, "true");
  localStorage.setItem(EULA_VERSION_KEY, EULA_VERSION);
}

export async function declineEula(): Promise<void> {
  const electronAPI = window.electronAPI;
  if (electronAPI?.window?.close) {
    await electronAPI.window.close();
    return;
  }
  window.close();
}
