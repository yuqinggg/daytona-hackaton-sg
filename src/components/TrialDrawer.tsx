"use client";

import { statusLabel } from "@/lib/labels";
import type { Trial } from "@/lib/types";

/**
 * Click any tile, see exactly what that machine did. This is what makes the
 * number credible - "here is trial 27, here is the log line where it forgot
 * to install uuid" beats any amount of asserting.
 */
export function TrialDrawer({ trial, onClose }: { trial: Trial | null; onClose: () => void }) {
  if (!trial) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-edge bg-panel shadow-2xl">
      <header className="flex items-center justify-between border-b border-edge px-6 py-4">
        <div>
          <p className="eyebrow">run detail</p>
          <h2 className="brand-heading mt-1 text-lg">Run {trial.index + 1}</h2>
          <p className="text-sm text-muted">
            {statusLabel(trial.status)}
            {trial.durationMs ? ` · took ${(trial.durationMs / 1000).toFixed(1)}s` : ""}
            {trial.sandboxId ? ` · machine ${trial.sandboxId}` : ""}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg border border-edge px-3 py-1.5 text-sm text-muted transition-colors hover:border-impact/50 hover:text-ink"
        >
          Close
        </button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5 text-sm">
        {trial.reason && (
          <div className="rounded-xl border border-fail/30 bg-fail/10 p-4 text-fail">
            <p className="eyebrow mb-1 text-fail">why this run ended</p>
            <p>{trial.reason}</p>
          </div>
        )}

        {trial.filesChanged && trial.filesChanged.length > 0 && (
          <div>
            <h3 className="eyebrow mb-2">files the agent edited</h3>
            <ul className="space-y-1 font-mono text-xs">
              {trial.filesChanged.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="eyebrow mb-2">what happened, step by step</h3>
          <ol className="space-y-1 text-xs text-muted">
            {trial.history.map((h, i) => (
              <li key={i}>
                <span className="font-mono">{new Date(h.at).toLocaleTimeString()}</span>{" "}
                {statusLabel(h.status)}
                {h.note ? ` - ${h.note}` : ""}
              </li>
            ))}
          </ol>
        </div>

        {trial.logTail && (
          <div>
            <h3 className="eyebrow mb-2">test output from this machine</h3>
            <pre className="overflow-x-auto rounded-xl border border-edge bg-canvas p-4 font-mono text-xs leading-relaxed">
              {trial.logTail}
            </pre>
          </div>
        )}
      </div>
    </aside>
  );
}
