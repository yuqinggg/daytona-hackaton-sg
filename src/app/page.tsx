"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { CustomTestForm, EMPTY_CUSTOM_TEST } from "@/components/CustomTestForm";
import { ReportCard } from "@/components/ReportCard";
import { RunControls } from "@/components/RunControls";
import { SandboxGrid } from "@/components/SandboxGrid";
import { TrialDrawer } from "@/components/TrialDrawer";
import type { Scenario } from "@/lib/scenario";
import { DEFAULT_TRIALS, type Run, type RunEvent, type Trial } from "@/lib/types";

export default function Page() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [archived, setArchived] = useState<Array<{ id: string; label: string }>>([]);
  const [archivedId, setArchivedId] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const [trials, setTrials] = useState(DEFAULT_TRIALS);
  const [run, setRun] = useState<Run | null>(null);
  const [selected, setSelected] = useState<Trial | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customTestEnabled, setCustomTestEnabled] = useState(false);
  const [customTest, setCustomTest] = useState(EMPTY_CUSTOM_TEST);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((d) => {
        setScenarios(d.scenarios ?? []);
        if (d.scenarios?.[0]) setScenarioId(d.scenarios[0].id);
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

  return (
    <main className="mx-auto max-w-6xl px-8 py-12">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-edge pb-10">
        <div>
          <p className="eyebrow">agent reliability report</p>
          <h1 className="brand-title mt-3 text-5xl">
            <span className="text-muted">reliability</span> report card
            <span className="text-impact">.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-muted">
            Your agent worked when you demoed it. Does it work 10 times in a row?
            Pick an agent, run it on 10 separate machines, and see how often it
            actually succeeds - and how it fails when it doesn&apos;t.
          </p>
        </div>
        <BrandMark size={72} />
      </header>

      <div className="mt-8">
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
          customTestEnabled={customTestEnabled}
          onToggleCustomTest={() => setCustomTestEnabled((enabled) => !enabled)}
          startDisabled={!customTestReady}
        />
      </div>

      {customTestEnabled && <CustomTestForm value={customTest} onChange={setCustomTest} />}

      {error && (
        <p className="mt-4 rounded-xl border border-fail/30 bg-fail/10 p-3 text-sm text-fail">
          Couldn&apos;t start: {error}
        </p>
      )}

      {!run && !error && (
        <div className="mt-8 rounded-2xl border border-dashed border-edge p-8 text-muted">
          <p className="eyebrow">nothing running yet</p>
          <p className="mt-3 max-w-xl text-sm">
            Press <span className="text-ink">Run it {trials} times</span> and
            each run gets its own throwaway machine, a fresh copy of the code,
            and the same instructions. Nothing is shared between them, so one
            run cannot help or break another. It takes a few minutes.
          </p>
        </div>
      )}

      {run && (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-ink">{run.scenarioName}</span>
              <span>
                · {done} of {run.trialCount} finished
              </span>
              {run.mock && (
                <span
                  className="rounded-full border border-warn px-3 py-0.5 text-xs text-warn"
                  title="Made-up results. No real machines and no real agent - practice mode."
                >
                  Simulated - not real results
                </span>
              )}
              {run.replayOf && (
                <span
                  className="rounded-full border border-impact/60 px-3 py-0.5 text-xs text-impact"
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
            <div className="mt-8">
              <ReportCard report={run.report} />
            </div>
          )}
        </>
      )}

      <TrialDrawer trial={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
