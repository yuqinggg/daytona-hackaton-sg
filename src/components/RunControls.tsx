"use client";

import type { Scenario } from "@/lib/scenario";
import { MAX_TRIALS } from "@/lib/types";

export function RunControls({
  scenarios,
  scenarioId,
  setScenarioId,
  trials,
  setTrials,
  onStart,
  onAbort,
  busy,
  archived,
  archivedId,
  setArchivedId,
  onReplay,
  customTestEnabled,
  onToggleCustomTest,
  startDisabled,
}: {
  scenarios: Scenario[];
  scenarioId: string;
  setScenarioId: (v: string) => void;
  trials: number;
  setTrials: (v: number) => void;
  onStart: () => void;
  onAbort: () => void;
  busy: boolean;
  archived: Array<{ id: string; label: string }>;
  archivedId: string;
  setArchivedId: (v: string) => void;
  onReplay: () => void;
  customTestEnabled: boolean;
  onToggleCustomTest: () => void;
  startDisabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
        Agent to test
        <select
          value={scenarioId}
          onChange={(e) => setScenarioId(e.target.value)}
          disabled={busy}
          title="Which coding agent should perform the benchmark task."
          className="rounded-lg border border-[var(--color-edge)] bg-[var(--color-panel)] px-3 py-2 text-sm"
        >
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
        How many times
        <input
          type="number"
          min={1}
          max={MAX_TRIALS}
          value={trials}
          onChange={(e) => setTrials(Number(e.target.value))}
          disabled={busy}
          title={`Each one runs on its own fresh machine. Maximum ${MAX_TRIALS}.`}
          className="w-20 rounded-lg border border-[var(--color-edge)] bg-[var(--color-panel)] px-3 py-2 text-sm text-[var(--color-ink)]"
        />
      </label>

      <button
        type="button"
        onClick={onToggleCustomTest}
        disabled={busy}
        aria-pressed={customTestEnabled}
        className="rounded-lg border border-[var(--color-edge)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-live)] disabled:opacity-40"
      >
        {customTestEnabled ? "Use built-in test" : "Add your test case"}
      </button>

      {busy ? (
        <button
          onClick={onAbort}
          className="rounded-lg bg-[var(--color-fail)] px-5 py-2 text-sm font-semibold text-white"
          title="Stop the remaining runs and shut down their machines."
        >
          Stop
        </button>
      ) : (
        <button
          onClick={onStart}
          disabled={startDisabled}
          className="rounded-lg bg-[var(--color-pass)] px-5 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
          title={`Starts ${trials} fresh machines and gives each one the same task.`}
        >
          Run it {trials} times
        </button>
      )}

      {archived.length > 0 && (
        <div className="ml-auto flex items-center gap-2 border-l border-[var(--color-edge)] pl-3">
          <select
            value={archivedId}
            onChange={(e) => setArchivedId(e.target.value)}
            disabled={busy}
            className="max-w-[22rem] rounded-lg border border-[var(--color-edge)] bg-[var(--color-panel)] px-3 py-2 text-sm text-[var(--color-muted)]"
          >
            {archived.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <button
            onClick={onReplay}
            disabled={busy}
            className="rounded-lg border border-[var(--color-edge)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] disabled:opacity-40"
            title="Play back a run that already happened. Real results, no new machines, no cost."
          >
            Show a past run
          </button>
        </div>
      )}
    </div>
  );
}
