"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ReportCard } from "@/components/ReportCard";
import { RunControls } from "@/components/RunControls";
import { SandboxGrid } from "@/components/SandboxGrid";
import { TrialDrawer } from "@/components/TrialDrawer";
import type { Scenario } from "@/lib/scenario";
import type { Run, RunEvent, Trial } from "@/lib/types";

export default function Page() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioId, setScenarioId] = useState("");
  const [trials, setTrials] = useState(50);
  const [run, setRun] = useState<Run | null>(null);
  const [selected, setSelected] = useState<Trial | null>(null);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((d) => {
        setScenarios(d.scenarios ?? []);
        if (d.scenarios?.[0]) setScenarioId(d.scenarios[0].id);
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
      body: JSON.stringify({ scenarioId, trials }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "failed to start");
    setRun(data.run);
    attach(data.run.id);
  };

  const abort = async () => {
    if (run) await fetch(`/api/runs/${run.id}`, { method: "DELETE" });
  };

  const busy = run?.status === "running";
  const done = run?.trials.filter((t) => ["passed", "failed", "errored"].includes(t.status)).length ?? 0;

  return (
    <main className="mx-auto max-w-6xl px-8 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Agent Reliability Report Card</h1>
        <p className="mt-2 text-[var(--color-muted)]">
          Your agent worked when you demoed it. Does it work 50 times in a row?
        </p>
      </header>

      <RunControls
        scenarios={scenarios}
        scenarioId={scenarioId}
        setScenarioId={setScenarioId}
        trials={trials}
        setTrials={setTrials}
        onStart={start}
        onAbort={abort}
        busy={!!busy}
      />

      {error && <p className="mt-4 text-sm text-[var(--color-fail)]">{error}</p>}

      {run && (
        <>
          <div className="mt-8 flex items-center justify-between text-sm text-[var(--color-muted)]">
            <span>
              {run.scenarioName} · {done}/{run.trialCount} complete
              {run.mock && " · SIMULATED"}
            </span>
            <span>concurrency {run.concurrency}</span>
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
