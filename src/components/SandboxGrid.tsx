"use client";

import { TrialTile } from "./TrialTile";
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
    <div className="grid grid-cols-10 gap-2">
      {trials.map((t) => (
        <TrialTile key={t.id} trial={t} onSelect={onSelect} />
      ))}
    </div>
  );
}
