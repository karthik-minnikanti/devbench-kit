import { useEffect, useState } from "react";
import { Icon } from "./Icon";

const DISMISS_KEY = "devbench:arch-mismatch-dismissed";

interface ArchMismatchInfo {
  appArch: string;
  machineArch: string;
  message: string;
  releasesUrl: string;
}

export function ArchMismatchBanner() {
  const [warning, setWarning] = useState<ArchMismatchInfo | null>(null);

  useEffect(() => {
    if (!window.electronAPI?.app?.getArchMismatch) {
      return;
    }

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed === "1") {
      return;
    }

    void window.electronAPI.app.getArchMismatch().then((result) => {
      if (
        result?.mismatch &&
        result.appArch &&
        result.machineArch &&
        result.message &&
        result.releasesUrl
      ) {
        setWarning({
          appArch: result.appArch,
          machineArch: result.machineArch,
          message: result.message,
          releasesUrl: result.releasesUrl,
        });
      }
    });
  }, []);

  if (!warning) {
    return null;
  }

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setWarning(null);
  };

  return (
    <div
      className="px-4 py-2.5 border-b border-amber-300/40 bg-amber-50 dark:bg-amber-950/30 text-sm text-amber-950 dark:text-amber-100 flex items-start gap-3"
      role="alert"
    >
      <Icon name="AlertTriangle" className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium">Wrong build for this Mac</p>
        <p className="text-xs mt-1 opacity-90">
          {warning.message} Installed: {warning.appArch} · This Mac:{" "}
          {warning.machineArch}.
        </p>
        <a
          href={warning.releasesUrl}
          className="inline-block mt-2 text-xs font-medium underline underline-offset-2"
          onClick={(event) => event.stopPropagation()}
        >
          Open GitHub Releases
        </a>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="text-xs font-medium px-2 py-1 rounded hover:bg-amber-200/50 dark:hover:bg-amber-900/40 flex-shrink-0"
        aria-label="Dismiss architecture warning"
      >
        Dismiss
      </button>
    </div>
  );
}
