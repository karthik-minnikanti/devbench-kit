import { useCallback, useEffect, useState } from "react";
import { INTERVAL_MS, SQUAT_GOAL, scheduleFromNow } from "./wellnessPrefs";

/** Original squat + water glass card, with smoother motion. */
export function WellnessBreakCard() {
  const [squats, setSquats] = useState(0);
  const [drank, setDrank] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [rep, setRep] = useState(false);

  const reset = useCallback(() => {
    setSquats(0);
    setDrank(false);
    setCelebrating(false);
    setRep(false);
  }, []);

  useEffect(() => {
    reset();
    const unsub = window.electronAPI?.window?.onWellnessReset?.(reset);
    return () => {
      unsub?.();
    };
  }, [reset]);

  const closeWindow = async () => {
    try {
      await window.electronAPI?.window?.closeWellnessBreak?.();
    } catch {
      window.close();
    }
  };

  const handleDone = () => {
    if (squats < SQUAT_GOAL || !drank || celebrating) return;
    setCelebrating(true);
    scheduleFromNow(INTERVAL_MS);
    window.setTimeout(() => {
      void closeWindow();
    }, 900);
  };

  const bumpSquat = () => {
    setSquats((n) => Math.min(SQUAT_GOAL, n + 1));
    setRep(true);
    window.setTimeout(() => setRep(false), 420);
  };

  const complete = squats >= SQUAT_GOAL && drank;

  return (
    <div className="wellness-window-shell">
      <div className="wellness-break" role="dialog" aria-label="Hourly wellness break">
        <div className="wellness-break__drag" aria-hidden="true" />
        <div className={`wellness-break__stage ${celebrating ? "is-celebrating" : ""}`} aria-hidden="true">
          <div className="wellness-break__floor" />

          <div
            className={`wellness-squatter ${
              squats >= SQUAT_GOAL
                ? "wellness-squatter--done"
                : rep
                  ? "wellness-squatter--rep"
                  : "wellness-squatter--active"
            }`}
          >
            <div className="wellness-squatter__shadow" />
            <div className="wellness-squatter__arms">
              <span />
              <span />
            </div>
            <div className="wellness-squatter__head" />
            <div className="wellness-squatter__body" />
            <div className="wellness-squatter__legs">
              <span />
              <span />
            </div>
          </div>

          <div
            className={`wellness-glass ${drank ? "wellness-glass--full" : ""} ${squats > 0 || drank ? "wellness-glass--filling" : ""}`}
          >
            <div className="wellness-glass__shine" />
            <div
              className="wellness-glass__water"
              style={{
                height: drank ? "78%" : `${Math.max(10, Math.min(squats * 7, 55))}%`,
              }}
            >
              <div className="wellness-glass__wave" />
            </div>
            <div className="wellness-glass__rim" />
          </div>

          {celebrating && <div className="wellness-break__confetti" />}
        </div>

        <div className="wellness-break__content">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Hourly reset
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              10 squats + a glass of water
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={bumpSquat} className="wellness-break__action">
              <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
                Squats
              </span>
              <span className="text-lg font-mono font-semibold tabular-nums text-[var(--color-text-primary)]">
                {squats}/{SQUAT_GOAL}
              </span>
              <span className="text-[10px] text-[var(--color-primary)]">
                {squats >= SQUAT_GOAL ? "Done" : "Tap each squat"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setDrank((v) => !v)}
              className={`wellness-break__action ${drank ? "wellness-break__action--done" : ""}`}
            >
              <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
                Water
              </span>
              <span className="text-lg font-semibold text-[var(--color-text-primary)]">
                {drank ? "Drunk" : "Drink"}
              </span>
              <span className="text-[10px] text-[var(--color-primary)]">
                {drank ? "Nice" : "Tap when finished"}
              </span>
            </button>
          </div>

          <div className="mt-3">
            <button
              type="button"
              disabled={!complete || celebrating}
              onClick={handleDone}
              className="px-3 py-1.5 bg-[var(--color-primary)] text-white rounded text-xs font-medium hover:opacity-90 disabled:opacity-40"
            >
              {complete ? "Done — see you in 1h" : "Complete both first"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
