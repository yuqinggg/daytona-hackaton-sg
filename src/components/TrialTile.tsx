"use client";

import type { Trial } from "@/lib/types";

const TILE_CLASS: Record<Trial["status"], string> = {
  queued: "bg-[var(--color-idle)]",
  provisioning: "bg-[var(--color-live)]/30 tile-live",
  seeding: "bg-[var(--color-live)]/50 tile-live",
  agent: "bg-[var(--color-live)] tile-live",
  verifying: "bg-[var(--color-warn)] tile-live",
  passed: "bg-[var(--color-pass)]",
  failed: "bg-[var(--color-fail)]",
  errored: "bg-[var(--color-warn)]/40",
};

export function TrialTile({ trial, onSelect }: { trial: Trial; onSelect: (t: Trial) => void }) {
  return (
    <button
      onClick={() => onSelect(trial)}
      title={`#${trial.index} - ${trial.status}${trial.reason ? ` - ${trial.reason}` : ""}`}
      className={`aspect-square rounded-md transition-colors duration-300 ${TILE_CLASS[trial.status]} hover:ring-2 hover:ring-white/40`}
    >
      <span className="sr-only">
        Trial {trial.index}: {trial.status}
      </span>
    </button>
  );
}
