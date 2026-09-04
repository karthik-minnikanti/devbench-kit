export const STORAGE_KEY = "devbench-wellness-break";
export const INTERVAL_MS = 60 * 60 * 1000;
export const SNOOZE_MS = 15 * 60 * 1000;
export const SQUAT_GOAL = 10;

export interface WellnessPrefs {
  enabled: boolean;
  nextAt: number;
  mutedUntil?: number;
}

export function readPrefs(): WellnessPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WellnessPrefs;
      return {
        enabled: parsed.enabled !== false,
        nextAt: typeof parsed.nextAt === "number" ? parsed.nextAt : Date.now() + INTERVAL_MS,
        mutedUntil: parsed.mutedUntil,
      };
    }
  } catch {
    /* ignore */
  }
  return { enabled: true, nextAt: Date.now() + INTERVAL_MS };
}

export function writePrefs(prefs: WellnessPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function scheduleFromNow(ms: number): WellnessPrefs {
  const prefs = { ...readPrefs(), nextAt: Date.now() + ms };
  writePrefs(prefs);
  return prefs;
}
