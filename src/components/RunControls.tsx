"use client";

import type { Scenario } from "@/lib/scenario";
import { MAX_TRIALS } from "@/lib/types";

const dashedField =
  "inline-flex items-center gap-3 rounded-[1.35rem] border-2 border-dashed border-[var(--color-pass)] bg-transparent px-3 py-2 align-middle";
const fieldControl =
  "min-w-0 bg-transparent text-2xl font-medium text-[var(--color-pass)] outline-none disabled:opacity-40";
const chip =
  "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-[0_2px_8px_rgba(0,0,0,0.35)]";

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
  startDisabled,
}: {
  scenarios: Scenario[];
  scenarioId: string;
  setScenarioId: (v: string) => void;
  trials: number | null;
  setTrials: (v: number | null) => void;
  onStart: () => void;
  onAbort: () => void;
  busy: boolean;
  archived: Array<{ id: string; label: string }>;
  archivedId: string;
  setArchivedId: (v: string) => void;
  onReplay: () => void;
  startDisabled: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 text-4xl font-bold leading-tight tracking-tight text-[var(--color-ink)]">
        <span>Test the agent of</span>

        <label
          className={`${dashedField} ${busy ? "opacity-40" : ""}`}
          title="Which coding agent should perform the benchmark task."
        >
          <span className={chip} aria-hidden>
            <PlusIcon />
          </span>
          <select
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            disabled={busy}
            aria-label="Agent to test"
            className={`${fieldControl} min-w-[11ch] cursor-pointer appearance-none pr-1`}
          >
            <option value="" disabled hidden>
              select model
            </option>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <span>for</span>

        <div
          className={`${dashedField} ${busy ? "opacity-40" : ""}`}
          title={`Each one runs on its own fresh machine. Maximum ${MAX_TRIALS}.`}
        >
          <button
            type="button"
            className={`${chip} disabled:cursor-not-allowed disabled:opacity-30`}
            disabled={busy || trials == null || trials <= 1}
            onClick={() => {
              if (trials == null || trials <= 1) return;
              setTrials(trials - 1);
            }}
            aria-label="Fewer times"
          >
            <MinusIcon />
          </button>
          <span
            className={`${fieldControl} min-w-[7ch] text-center tabular-nums`}
            aria-live="polite"
          >
            {trials ?? "number"}
          </span>
          <button
            type="button"
            className={`${chip} disabled:cursor-not-allowed disabled:opacity-30`}
            disabled={busy || (trials != null && trials >= MAX_TRIALS)}
            onClick={() => setTrials(trials == null ? 1 : Math.min(MAX_TRIALS, trials + 1))}
            aria-label="More times"
          >
            <PlusIcon />
          </button>
        </div>

        <span>{trials === 1 ? "time." : "times."}</span>
      </div>

      {busy ? (
        <button
          onClick={onAbort}
          className="rounded-2xl bg-[var(--color-fail)] px-6 py-3 text-base font-semibold text-white"
          title="Stop the remaining runs and shut down their machines."
        >
          Stop
        </button>
      ) : (
        <button
          onClick={onStart}
          disabled={startDisabled}
          className="rounded-2xl bg-[var(--color-pass)] px-6 py-3 text-base font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
          title={
            trials == null
              ? "Pick how many fresh machines to start."
              : `Starts ${trials} fresh machines and gives each one the same task.`
          }
        >
          {trials == null
            ? "Run it"
            : `Run it ${trials} ${trials === 1 ? "time" : "times"}`}
        </button>
      )}

      {archived.length > 0 && (
        <div className="flex items-center gap-2 border-l border-[var(--color-edge)] pl-3">
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

function MinusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M1.5 6h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M6 1.5v9M1.5 6h9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
