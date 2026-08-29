"use client";

import type { Scenario } from "@/lib/scenario";
import { MAX_TRIALS } from "@/lib/types";

/**
 * The control reads as one sentence - "Test the agent of X for N times." -
 * with the two variables sitting inline as dashed pills. Stating the
 * experiment in words rather than stacking labelled fields means the room
 * reads the setup in one pass, which is the whole job of this panel.
 */
const PILL =
  "inline-flex items-center gap-3 rounded-full border-2 border-dashed border-sprout px-3 py-1.5 align-middle";

/** The white disc that carries every glyph in the sentence. */
const DISC =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ash text-2xl leading-none text-canvas transition-opacity";

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
  const step = (delta: number) =>
    setTrials(Math.min(MAX_TRIALS, Math.max(1, trials + delta)));

  return (
    <div className="rounded-2xl border border-edge bg-panel p-8">
      <p className="text-3xl font-bold leading-[1.9] tracking-tight text-ink">
        Test the agent of{" "}
        <label className={`${PILL} cursor-pointer`}>
          {/* Decorative: the select underneath is what actually opens. */}
          <span className={DISC} aria-hidden="true">
            +
          </span>
          <span className="sr-only">Agent to test</span>
          <select
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            disabled={busy}
            title="Which coding agent should perform the benchmark task."
            className="cursor-pointer appearance-none bg-transparent pr-2 text-[0.8em] font-semibold text-sprout outline-none disabled:opacity-50"
          >
            {scenarios.length === 0 && <option value="">select model</option>}
            {scenarios.map((s) => (
              <option key={s.id} value={s.id} className="bg-panel text-ink">
                {s.name}
              </option>
            ))}
          </select>
        </label>{" "}
        for{" "}
        <span
          className={PILL}
          role="group"
          aria-label="How many times to run it"
          title={`Each one runs on its own fresh machine. Maximum ${MAX_TRIALS}.`}
        >
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={busy || trials <= 1}
            aria-label="One fewer run"
            className={`${DISC} hover:opacity-80 disabled:opacity-30`}
          >
            &minus;
          </button>
          <span className="min-w-10 text-center text-[0.8em] font-semibold tabular-nums text-sprout">
            {trials}
          </span>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={busy || trials >= MAX_TRIALS}
            aria-label="One more run"
            className={`${DISC} hover:opacity-80 disabled:opacity-30`}
          >
            +
          </button>
        </span>{" "}
        times.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        {busy ? (
          <button
            onClick={onAbort}
            className="rounded-2xl bg-fail px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            title="Stop the remaining runs and shut down their machines."
          >
            Stop
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={startDisabled}
            className="rounded-2xl bg-forest px-6 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            title={`Starts ${trials} fresh machines and gives each one the same task.`}
          >
            Run it {trials} times
          </button>
        )}

        <button
          type="button"
          onClick={onToggleCustomTest}
          disabled={busy}
          aria-pressed={customTestEnabled}
          className={`rounded-2xl border px-6 py-3 text-sm font-semibold transition-colors disabled:opacity-40 ${
            customTestEnabled
              ? "border-impact text-impact"
              : "border-edge text-ink hover:border-impact/50"
          }`}
        >
          {customTestEnabled ? "Use built-in test" : "Add your test case"}
        </button>
      </div>

      {archived.length > 0 && (
        <div className="mt-7 flex flex-wrap items-center gap-2 border-t border-edge pt-6">
          <span className="eyebrow mr-1">or look back</span>
          <select
            value={archivedId}
            onChange={(e) => setArchivedId(e.target.value)}
            disabled={busy}
            className="max-w-[20rem] rounded-lg border border-edge bg-raised px-3 py-2 text-sm text-ink transition-colors hover:border-impact/50 disabled:opacity-40"
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
            className="rounded-lg border border-edge px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-impact/50 disabled:opacity-40"
            title="Play back a run that already happened. Real results, no new machines, no cost."
          >
            Show a past run
          </button>
        </div>
      )}
    </div>
  );
}
