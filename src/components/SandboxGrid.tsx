"use client";

import { TrialTile } from "./TrialTile";
import { LEGEND } from "@/lib/labels";
import type { Trial } from "@/lib/types";

/**
 * The money shot: every trial visible at once, tiles resolving green and red
 * in real time. All N tiles render from the first frame - the audience should
 * see the size of the experiment before it starts filling in.
 */
export function SandboxGrid({
  trials,
  onSelect,
}: {
  trials: Trial[];
  onSelect: (t: Trial) => void;
}) {
  return (
    <div className="rounded-2xl border border-edge bg-panel p-5">
      <p className="eyebrow mb-4">live runs</p>

      <div className="grid grid-cols-10 gap-2">
        {trials.map((t) => (
          <TrialTile key={t.id} trial={t} onSelect={onSelect} />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-edge pt-4 text-xs text-muted">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-2" title={l.help}>
            <span className={`h-3 w-3 rounded-sm ${l.className}`} aria-hidden="true" />
            {l.label}
          </span>
        ))}
        <span className="opacity-70">
          Each square is one run on its own machine. Click any square to see what happened.
        </span>
      </div>
    </div>
  );
}
