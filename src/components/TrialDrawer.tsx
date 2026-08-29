"use client";

import type { Trial } from "@/lib/types";

/**
 * Click any tile, see exactly what that machine did. This is what makes the
 * number credible - "here is trial 27, here is the log line where it forgot
 * to install uuid" beats any amount of asserting.
 */
export function TrialDrawer({ trial, onClose }: { trial: Trial | null; onClose: () => void }) {
  if (!trial) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-[var(--color-edge)] bg-[var(--color-panel)] shadow-2xl">
      <header className="flex items-center justify-between border-b border-[var(--color-edge)] px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold">Trial #{trial.index}</h2>
          <p className="text-sm text-[var(--color-muted)]">
            {trial.status}
            {trial.durationMs ? ` · ${(trial.durationMs / 1000).toFixed(1)}s` : ""}
            {trial.sandboxId ? ` · ${trial.sandboxId}` : ""}
          </p>
        </div>
        <button onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          close
        </button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5 text-sm">
        {trial.reason && (
          <p className="rounded-lg bg-[var(--color-fail)]/10 p-4 text-[var(--color-fail)]">
            {trial.reason}
          </p>
        )}

        {trial.filesChanged && trial.filesChanged.length > 0 && (
          <div>
            <h3 className="mb-2 text-[var(--color-muted)]">files changed</h3>
            <ul className="space-y-1 font-mono text-xs">
              {trial.filesChanged.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-[var(--color-muted)]">timeline</h3>
          <ol className="space-y-1 font-mono text-xs text-[var(--color-muted)]">
            {trial.history.map((h, i) => (
              <li key={i}>
                {new Date(h.at).toLocaleTimeString()} {h.status}
                {h.note ? ` - ${h.note}` : ""}
              </li>
            ))}
          </ol>
        </div>

        {trial.logTail && (
          <div>
            <h3 className="mb-2 text-[var(--color-muted)]">verify output</h3>
            <pre className="overflow-x-auto rounded-lg bg-black/40 p-4 font-mono text-xs leading-relaxed">
              {trial.logTail}
            </pre>
          </div>
        )}
      </div>
    </aside>
  );
}
