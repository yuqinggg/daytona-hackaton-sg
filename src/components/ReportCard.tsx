"use client";

import { modeLabel } from "@/lib/labels";
import type { RunReport } from "@/lib/types";

/**
 * The closing slide, rendered live. Success rate is set at a size that reads
 * from the back of the room; the failure breakdown underneath is the part that
 * turns a number into an insight.
 */
export function ReportCard({ report }: { report: RunReport }) {
  const pct = Math.round(report.successRate * 100);
  const worst = report.buckets[0];

  return (
    <section className="rounded-2xl border border-[var(--color-edge)] bg-[var(--color-panel)] p-8">
      <div className="flex flex-wrap items-baseline gap-6">
        <div className="text-8xl font-bold tabular-nums leading-none">{pct}%</div>
        <div className="text-lg text-[var(--color-muted)]">
          of runs that finished
          <div className="text-sm">
            {report.passed} passed &middot; {report.failed} failed
          </div>
          {report.errored > 0 && (
            <div className="mt-1 text-sm text-[var(--color-warn)]">
              {report.errored} {report.errored === 1 ? "run" : "runs"} left out of the score -
              our setup or the model provider broke, not the agent
            </div>
          )}
        </div>
      </div>

      {worst && (
        <p className="mt-6 text-2xl">
          When it failed, most often it{" "}
          <span className="font-semibold text-[var(--color-fail)]">
            {modeLabel(worst.mode)}
          </span>
        </p>
      )}

      <FailureBreakdown report={report} />

      <p className="mt-6 text-sm text-[var(--color-muted)]">
        A typical run took {(report.medianDurationMs / 1000).toFixed(1)}s.
        {report.total < 20 &&
          ` With only ${report.total} runs, treat this percentage as a rough signal - the failure reasons below are the reliable part.`}
      </p>
    </section>
  );
}

function FailureBreakdown({ report }: { report: RunReport }) {
  if (report.buckets.length === 0) return null;
  const max = report.buckets[0].count;

  return (
    <div className="mt-8 space-y-3">
      <p className="text-sm text-[var(--color-muted)]">Why the failed runs failed</p>
      {report.buckets.map((b) => (
        <div key={b.mode} className="flex items-center gap-4">
          <div className="w-64 shrink-0 text-right text-sm">{modeLabel(b.mode)}</div>
          <div className="h-7 flex-1 rounded bg-[var(--color-idle)]">
            <div
              className="h-full rounded bg-[var(--color-fail)] transition-all duration-500"
              style={{ width: `${(b.count / max) * 100}%` }}
            />
          </div>
          <div className="w-10 text-sm tabular-nums text-[var(--color-muted)]">{b.count}</div>
        </div>
      ))}
    </div>
  );
}
