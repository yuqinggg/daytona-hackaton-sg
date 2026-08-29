"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CustomTestForm, EMPTY_CUSTOM_TEST } from "@/components/CustomTestForm";
import { ReportCard } from "@/components/ReportCard";
import { RunControls } from "@/components/RunControls";
import { SandboxGrid } from "@/components/SandboxGrid";
import { TrialDrawer } from "@/components/TrialDrawer";
import type { Scenario } from "@/lib/scenario";
import type { Run, RunEvent, Trial } from "@/lib/types";

export default function Page() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [archived, setArchived] = useState<Array<{ id: string; label: string }>>([]);
  const [archivedId, setArchivedId] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const [trials, setTrials] = useState<number | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [selected, setSelected] = useState<Trial | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customTestEnabled, setCustomTestEnabled] = useState(true);
  const [customTest, setCustomTest] = useState(EMPTY_CUSTOM_TEST);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((d) => {
        setScenarios(d.scenarios ?? []);
        setArchived(d.archived ?? []);
        if (d.archived?.[0]) setArchivedId(d.archived[0].id);
      })
      .catch(() => setError("could not load scenarios"));
  }, []);

  /** One SSE connection per run; snapshot on connect, deltas after. */
  const attach = useCallback((runId: string) => {
    esRef.current?.close();
    const es = new EventSource(`/api/runs/${runId}/stream`);
    esRef.current = es;

    es.onmessage = (msg) => {
      const event: RunEvent = JSON.parse(msg.data);
      setRun((prev) => {
        if (event.type === "run:snapshot") return event.run;
        if (!prev) return prev;
        if (event.type === "trial:update") {
          return {
            ...prev,
            trials: prev.trials.map((t) => (t.id === event.trial.id ? event.trial : t)),
          };
        }
        if (event.type === "run:report") return { ...prev, report: event.report };
        if (event.type === "run:done") return { ...prev, status: event.status };
        return prev;
      });
      if (event.type === "run:done") es.close();
    };
    es.onerror = () => es.close();
  }, []);

  useEffect(() => () => esRef.current?.close(), []);

  const start = async () => {
    if (!scenarioId || trials == null) return;
    setError(null);
    setRun(null);
    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenarioId,
        trials,
        customTest: customTestEnabled ? customTest : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "failed to start");
    setRun(data.run);
    attach(data.run.id);
  };

  /** Show a recorded run. Spends nothing; works with no network. */
  const replay = async () => {
    setError(null);
    setRun(null);
    const res = await fetch("/api/runs/replay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: archivedId }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "replay failed");
    setRun(data.run);
    attach(data.run.id);
  };

  const abort = async () => {
    if (run) await fetch(`/api/runs/${run.id}`, { method: "DELETE" });
  };

  const busy = run?.status === "running";
  const done = run?.trials.filter((t) => ["passed", "failed", "errored"].includes(t.status)).length ?? 0;
  const customTestReady =
    !customTestEnabled || Object.values(customTest).every((value) => value.trim().length > 0);
  const selectionReady = Boolean(scenarioId) && trials != null && trials >= 1;

  return (
    <main className="mx-auto max-w-6xl px-8 py-10">
      <header className="mb-8 flex items-start gap-4">
        <img
          src="/logo.png"
          alt=""
          width={56}
          height={56}
          className="mt-0.5 h-14 w-14 shrink-0 rounded-full"
        />
        <div>
          <h1 className="text-3xl font-bold">Agent Reliability Report Card</h1>
          <p className="mt-2 max-w-2xl text-[var(--color-muted)]">
            Your agent worked when you demoed it. Does it work 10 times in a row?
            Pick an agent, run it on 10 separate machines, and see how often it
            actually succeeds - and how it fails when it doesn't.
          </p>
        </div>
      </header>

      <div className="sticky top-0 z-20 -mx-2 mb-5 border-b border-[var(--color-edge)] bg-[var(--color-canvas)]/95 px-2 pt-2 backdrop-blur">
        <div
          role="tablist"
          aria-label="Test case source"
          className="flex gap-1"
        >
          <button
            id="built-in-test-tab"
            type="button"
            role="tab"
            aria-selected={!customTestEnabled}
            aria-controls="built-in-test-panel"
            disabled={!!busy}
            onClick={() => setCustomTestEnabled(false)}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-40 ${
              !customTestEnabled
                ? "border-[var(--color-live)] text-[var(--color-ink)]"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            Built-in test
          </button>
          <button
            id="custom-test-tab"
            type="button"
            role="tab"
            aria-selected={customTestEnabled}
            aria-controls="custom-test-panel"
            disabled={!!busy}
            onClick={() => setCustomTestEnabled(true)}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-40 ${
              customTestEnabled
                ? "border-[var(--color-live)] text-[var(--color-ink)]"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            Build your test case
          </button>
        </div>
      </div>

      <RunControls
        scenarios={scenarios}
        scenarioId={scenarioId}
        setScenarioId={setScenarioId}
        trials={trials}
        setTrials={setTrials}
        onStart={start}
        onAbort={abort}
        busy={!!busy}
        archived={archived}
        archivedId={archivedId}
        setArchivedId={setArchivedId}
        onReplay={replay}
        startDisabled={!customTestReady || !selectionReady}
      />

      {customTestEnabled ? (
        <div
          id="custom-test-panel"
          role="tabpanel"
          aria-labelledby="custom-test-tab"
        >
          <CustomTestForm value={customTest} onChange={setCustomTest} />
        </div>
      ) : (
        <section
          id="built-in-test-panel"
          role="tabpanel"
          aria-labelledby="built-in-test-tab"
          className="mt-5 rounded-2xl border border-[var(--color-edge)] bg-[var(--color-panel)] p-5"
        >
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Built-in test</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted)]">
            Run the ready-made reliability test for the selected agent. No setup is required.
          </p>
        </section>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-[var(--color-fail)]/10 p-3 text-sm text-[var(--color-fail)]">
          Couldn&apos;t start: {error}
        </p>
      )}

      {!run && !error && (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--color-edge)] p-8 text-[var(--color-muted)]">
          <p className="text-[var(--color-ink)]">Nothing running yet.</p>
          <p className="mt-2 max-w-xl text-sm">
            Press <span className="text-[var(--color-ink)]">Run it</span> and
            each run gets its own throwaway machine, a fresh copy of the code,
            and the same instructions. Nothing is shared between them, so one
            run cannot help or break another. It takes a few minutes.
          </p>
        </div>
      )}

      {run && (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-muted)]">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[var(--color-ink)]">{run.scenarioName}</span>
              <span>
                · {done} of {run.trialCount} finished
              </span>
              {run.mock && (
                <span
                  className="rounded border border-[var(--color-warn)] px-2 py-0.5 text-xs text-[var(--color-warn)]"
                  title="Made-up results. No real machines and no real agent - practice mode."
                >
                  Simulated - not real results
                </span>
              )}
              {run.replayOf && (
                <span
                  className="rounded border border-[var(--color-live)] px-2 py-0.5 text-xs text-[var(--color-live)]"
                  title="These results really happened. Only the timing is sped up for playback."
                >
                  Replay of an earlier run
                </span>
              )}
            </span>
            <span title="How many machines run at the same time.">
              {run.concurrency} at a time
            </span>
          </div>

          <div className="mt-4">
            <SandboxGrid trials={run.trials} onSelect={setSelected} />
          </div>

          {run.report && (
            <div className="mt-10">
              <ReportCard report={run.report} />
            </div>
          )}
        </>
      )}

      <TrialDrawer trial={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
