"use client";

import { statusLabel } from "@/lib/labels";
import type { Trial } from "@/lib/types";

/**
 * In-progress stages climb the brand's green ramp - deep forest to impact
 * green - so a filling grid reads as one gradient resolving rather than five
 * unrelated colours. Only the terminal states break out of the ramp.
 */
const TILE_CLASS: Record<Trial["status"], string> = {
  queued: "bg-idle",
  provisioning: "bg-stage-1 tile-live",
  seeding: "bg-stage-2 tile-live",
  agent: "bg-stage-3 tile-live",
  verifying: "bg-stage-4 tile-live",
  passed: "bg-pass",
  failed: "bg-fail",
  errored: "bg-warn",
};

export function TrialTile({ trial, onSelect }: { trial: Trial; onSelect: (t: Trial) => void }) {
  return (
    <button
      onClick={() => onSelect(trial)}
      title={`Run ${trial.index + 1} - ${statusLabel(trial.status)}${trial.reason ? `: ${trial.reason}` : ""}. Click for details.`}
      className={`aspect-square rounded-lg transition-colors duration-300 hover:ring-2 hover:ring-impact/60 ${TILE_CLASS[trial.status]}`}
    >
      <span className="sr-only">
        Run {trial.index + 1}: {statusLabel(trial.status)}. Click for details.
      </span>
    </button>
  );
}
