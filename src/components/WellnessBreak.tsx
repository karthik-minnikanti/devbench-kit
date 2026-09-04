import { useCallback, useEffect, useRef } from "react";
import { INTERVAL_MS, STORAGE_KEY, readPrefs, scheduleFromNow } from "./wellnessPrefs";

async function pingOsNotification() {
  try {
    await window.electronAPI?.notification?.show({
      title: "Hourly reset",
      body: "Do 10 squats and drink a glass of water.",
      silent: false,
    });
  } catch {
    /* ignore */
  }
}

async function openFloatingBreak() {
  try {
    await window.electronAPI?.window?.openWellnessBreak?.();
  } catch {
    /* ignore */
  }
}

/** Schedules the hourly break and opens a separate floating Electron window. */
export function WellnessBreak() {
  const timerRef = useRef<number | null>(null);
  const isOpenRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const showBreak = useCallback(() => {
    if (isOpenRef.current) return;
    const prefs = readPrefs();
    if (!prefs.enabled) return;
    if (prefs.mutedUntil && prefs.mutedUntil > Date.now()) return;
    isOpenRef.current = true;
    // Default next hour; snooze/mute/done in the float window may overwrite.
    scheduleFromNow(INTERVAL_MS);
    void pingOsNotification();
    void openFloatingBreak();
  }, []);

  const armTimer = useCallback(() => {
    clearTimer();
    const prefs = readPrefs();
    if (!prefs.enabled) return;
    if (prefs.mutedUntil && prefs.mutedUntil > Date.now()) {
      timerRef.current = window.setTimeout(armTimer, prefs.mutedUntil - Date.now() + 250);
      return;
    }
    const delay = Math.max(prefs.nextAt - Date.now(), 1_000);
    timerRef.current = window.setTimeout(() => {
      showBreak();
      armTimer();
    }, delay);
  }, [showBreak]);

  useEffect(() => {
    armTimer();

    const onVisibility = () => {
      if (document.hidden) return;
      const prefs = readPrefs();
      if (
        !isOpenRef.current &&
        prefs.enabled &&
        Date.now() >= prefs.nextAt &&
        !(prefs.mutedUntil && prefs.mutedUntil > Date.now())
      ) {
        showBreak();
        armTimer();
      } else {
        armTimer();
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) armTimer();
    };

    const unsubClosed = window.electronAPI?.window?.onWellnessClosed?.(() => {
      isOpenRef.current = false;
      armTimer();
    });

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);
    return () => {
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
      unsubClosed?.();
    };
  }, [armTimer, showBreak]);

  return null;
}
