"use client";

import { modeLabel } from "@/lib/labels";
import type { RunReport } from "@/lib/types";

/**
 * The closing slide, rendered live. Built as the guide's "key metric" block:
 * a ring, one enormous number in impact green, and the supporting counts kept
 * quiet underneath. The failure breakdown below it is the part that turns a
 * number into an insight.
 */
export function ReportCard({ report }: { report: RunReport }) {
  const pct = Math.round(report.successRate * 100);
  const worst = report.buckets[0];

  return (
    <section className="rounded-2xl border border-edge bg-panel p-8">
      <p className="eyebrow">report card</p>

      <div className="mt-6 flex flex-wrap items-center gap-x-10 gap-y-6">
        <ResultRing report={report} />

        <div>
          <div className="text-8xl font-bold leading-none tracking-tight tabular-nums text-impact">
            {pct}%
          </div>
          <p className="mt-3 text-lg text-muted">of runs that finished</p>
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Count swatch="bg-pass" label="passed" value={report.passed} />
            <Count swatch="bg-fail" label="failed" value={report.failed} />
            {report.errored > 0 && (
              <Count swatch="bg-warn" label="didn't count" value={report.errored} />
            )}
          </dl>
        </div>
      </div>

      {report.errored > 0 && (
        <p className="mt-5 text-sm text-muted">
          {report.errored} {report.errored === 1 ? "run" : "runs"} left out of the score - our
          setup or the model provider broke, not the agent.
        </p>
      )}

      {worst && (
        <p className="mt-8 border-t border-edge pt-8 text-2xl">
          When it failed, most often it{" "}
          <span className="font-semibold text-fail">{modeLabel(worst.mode)}</span>
        </p>
      )}

      <FailureBreakdown report={report} />

      <p className="mt-8 text-sm text-muted">
        A typical run took {(report.medianDurationMs / 1000).toFixed(1)}s.
        {report.total < 20 &&
          ` With only ${report.total} runs, treat this percentage as a rough signal - the failure reasons below are the reliable part.`}
      </p>
    </section>
  );
}

function Count({ swatch, label, value }: { swatch: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-sm ${swatch}`} aria-hidden="true" />
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * The guide's donut, drawn as three stroked arcs on one circle. Arc lengths
 * come straight from the counts, so an all-green ring is a genuinely all-green
 * run rather than a rounding artefact.
 */
function ResultRing({ report }: { report: RunReport }) {
  const total = report.passed + report.failed + report.errored;
  if (total === 0) return null;

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { value: report.passed, color: "var(--color-pass)" },
    { value: report.failed, color: "var(--color-fail)" },
    { value: report.errored, color: "var(--color-warn)" },
  ].filter((s) => s.value > 0);

  let offset = 0;

  return (
    <svg width="140" height="140" viewBox="0 0 140 140" role="presentation" className="shrink-0">
      <circle
        cx="70"
        cy="70"
        r={radius}
        fill="none"
        stroke="var(--color-idle)"
        strokeWidth="16"
      />
      {segments.map((segment) => {
        const length = (segment.value / total) * circumference;
        // A 2px gap keeps adjacent segments legible without shifting the arcs.
        const dash = `${Math.max(0, length - 2)} ${circumference - Math.max(0, length - 2)}`;
        const rotation = (offset / total) * 360 - 90;
        offset += segment.value;

        return (
          <circle
            key={segment.color}
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth="16"
            strokeLinecap="butt"
            strokeDasharray={dash}
            transform={`rotate(${rotation} 70 70)`}
            className="transition-all duration-500"
          />
        );
      })}
    </svg>
  );
}

function FailureBreakdown({ report }: { report: RunReport }) {
  if (report.buckets.length === 0) return null;
  const max = report.buckets[0].count;

  return (
    <div className="mt-8 space-y-3">
      <p className="eyebrow">why the failed runs failed</p>
      {report.buckets.map((b, i) => (
        <div key={b.mode} className="flex items-center gap-4">
          <div className="w-64 shrink-0 text-right text-sm">{modeLabel(b.mode)}</div>
          <div className="h-7 flex-1 overflow-hidden rounded-lg bg-idle">
            <div
              // Only the leading cause gets the alarm colour; the tail is
              // context, and painting all of it red flattens the ranking.
              className={`h-full rounded-lg transition-all duration-500 ${
                i === 0 ? "bg-fail" : "bg-ash/25"
              }`}
              style={{ width: `${(b.count / max) * 100}%` }}
            />
          </div>
          <div className="w-10 text-sm tabular-nums text-muted">{b.count}</div>
        </div>
      ))}
    </div>
  );
}
