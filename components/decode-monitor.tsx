"use client";

import { DecodeReadout, type ReadoutLine } from "@/components/decode-readout";

/**
 * The Decode presented as a film-cutting monitor: sharp corners, hairline frame,
 * a slate header bar (REC + format counter + timecode), scanlines over the feed.
 * Deliberately NOT a rounded card — this is the loud centerpiece.
 */
export function DecodeMonitor({
  lines,
  replayKey,
  index,
  total,
}: {
  lines: ReadoutLine[];
  replayKey: number;
  index: number;
  total: number;
}) {
  return (
    <div className="border border-white/12 bg-black/55 shadow-[0_0_60px_-15px_rgba(57,255,122,0.25)]">
      {/* slate header */}
      <div className="flex items-center justify-between border-b border-white/12 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-signal shadow-[0_0_8px_var(--color-signal)]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal">
            decoding
          </span>
        </div>
        <span className="font-mono text-[10px] tracking-[0.18em] text-muted">
          SAMPLE {String(index + 1).padStart(2, "0")}/
          {String(total).padStart(2, "0")} · 01:42:18
        </span>
      </div>

      {/* the live feed */}
      <div className="scanlines relative overflow-hidden px-5 py-6 sm:px-7 sm:py-7">
        <DecodeReadout lines={lines} replayKey={replayKey} />
      </div>
    </div>
  );
}
