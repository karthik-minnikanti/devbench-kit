import { useState } from "react";
import { EULA_TEXT, EULA_URL } from "../content/eula";
import { acceptEula, declineEula } from "../utils/eula";

interface EulaModalProps {
  onAccepted: () => void;
}

export function EulaModal({ onAccepted }: EulaModalProps) {
  const [agreed, setAgreed] = useState(false);

  const handleAccept = () => {
    acceptEula();
    onAccepted();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div
        className="modal-panel w-full max-w-2xl max-h-[90vh] flex flex-col"
        role="dialog"
        aria-labelledby="eula-title"
        aria-modal="true"
      >
        <div className="px-6 pt-6 pb-4 border-b border-[var(--color-border)]">
          <h2 id="eula-title" className="title-md">
            License Agreement
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            DevBench is licensed for use only. Redistribution and resale are not
            permitted.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--color-text-secondary)] font-sans">
            {EULA_TEXT}
          </pre>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-4">
            Full terms:{" "}
            <a
              href={EULA_URL}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-primary)] underline underline-offset-2"
            >
              devbench.in/eula
            </a>
          </p>
        </div>

        <div className="px-6 py-4 border-t border-[var(--color-border)] space-y-4">
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I have read and agree to the DevBench End User License Agreement. I
              understand I may use the Software but may not redistribute or sell it.
            </span>
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => void declineEula()}
              className="btn-secondary text-sm"
            >
              Decline &amp; Exit
            </button>
            <button
              type="button"
              onClick={handleAccept}
              disabled={!agreed}
              className="btn-primary text-sm disabled:opacity-50"
            >
              Accept &amp; Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
