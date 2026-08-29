"use client";

import type { Scenario } from "@/lib/scenario";

export function RunControls({
  scenarios,
  scenarioId,
  setScenarioId,
  trials,
  setTrials,
  onStart,
  onAbort,
  busy,
}: {
  scenarios: Scenario[];
  scenarioId: string;
  setScenarioId: (v: string) => void;
  trials: number;
  setTrials: (v: number) => void;
  onStart: () => void;
  onAbort: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={scenarioId}
        onChange={(e) => setScenarioId(e.target.value)}
        disabled={busy}
        className="rounded-lg border border-[var(--color-edge)] bg-[var(--color-panel)] px-3 py-2 text-sm"
      >
        {scenarios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
        trials
        <input
          type="number"
          min={1}
          max={200}
          value={trials}
          onChange={(e) => setTrials(Number(e.target.value))}
          disabled={busy}
          className="w-20 rounded-lg border border-[var(--color-edge)] bg-[var(--color-panel)] px-3 py-2 text-sm text-[var(--color-ink)]"
        />
      </label>

      {busy ? (
        <button
          onClick={onAbort}
          className="rounded-lg bg-[var(--color-fail)] px-5 py-2 text-sm font-semibold text-white"
        >
          Abort
        </button>
      ) : (
        <button
          onClick={onStart}
          className="rounded-lg bg-[var(--color-pass)] px-5 py-2 text-sm font-semibold text-black"
        >
          Run it 50 times
        </button>
      )}
    </div>
  );
}
