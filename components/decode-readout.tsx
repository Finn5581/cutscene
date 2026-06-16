"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { resolveAt } from "@/lib/scramble";

export interface ReadoutLine {
  label: string;
  value: string;
  /** "locked" renders muted + non-animated (e.g. the gated scene-match teaser). */
  kind?: "data" | "locked";
}

/**
 * The signature forensic "scan". Lines resolve one at a time, top to bottom,
 * via a ref-driven scramble (DOM mutated per frame — never setState). Reusable:
 * Phase 2 feeds it real AI output, Phase 0 feeds it the scripted sample.
 */
export function DecodeReadout({
  lines,
  replayKey = 0,
}: {
  lines: ReadoutLine[];
  replayKey?: number;
}) {
  const reduced = useReducedMotion();
  const valueRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);

  const fullText = lines.map((l) => `${l.label}: ${l.value}`).join(". ");

  useEffect(() => {
    const setResolved = (i: number, v: boolean) =>
      lineRefs.current[i]?.setAttribute("data-resolved", String(v));

    // Reduced motion (and the SSR default): show final text immediately.
    if (reduced) {
      lines.forEach((l, i) => {
        const el = valueRefs.current[i];
        if (el) el.textContent = l.value;
        setResolved(i, true);
      });
      return;
    }

    let cancelled = false;
    let raf = 0;

    const animateLine = (i: number) =>
      new Promise<void>((done) => {
        if (lines[i].kind === "locked") {
          const el = valueRefs.current[i];
          if (el) el.textContent = lines[i].value;
          setResolved(i, true);
          return done();
        }
        const target = lines[i].value;
        const el = valueRefs.current[i];
        if (!el) return done();
        setResolved(i, false);
        const total = Math.max(220, target.length * 26);
        const start = performance.now();
        const tick = (now: number) => {
          if (cancelled) return;
          const p = Math.min(1, (now - start) / total);
          const count = Math.floor(p * target.length);
          el.textContent = resolveAt(target, count, Math.random).text;
          if (p < 1) {
            raf = requestAnimationFrame(tick);
          } else {
            el.textContent = target;
            setResolved(i, true);
            done();
          }
        };
        raf = requestAnimationFrame(tick);
      });

    const run = async () => {
      // seed every line as noise so the whole block reads "scrambled" first
      lines.forEach((l, i) => {
        const el = valueRefs.current[i];
        if (el && l.kind !== "locked") {
          el.textContent = resolveAt(l.value, 0, Math.random).text;
        }
        setResolved(i, l.kind === "locked");
      });
      for (let i = 0; i < lines.length; i++) {
        if (cancelled) return;
        await animateLine(i);
        await new Promise((r) => setTimeout(r, 90));
      }
    };
    run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [reduced, replayKey, lines]);

  return (
    <div
      aria-label={fullText}
      className="font-mono text-sm leading-relaxed sm:text-base"
    >
      <div aria-hidden className="space-y-2">
        {lines.map((l, i) => (
          <div
            key={`${l.label}-${i}`}
            ref={(n) => {
              lineRefs.current[i] = n;
            }}
            data-resolved="false"
            className="group flex flex-wrap items-baseline gap-x-3 gap-y-1"
          >
            <span className="hud shrink-0 text-xs text-signal sm:text-sm">
              [ {l.label} ]
            </span>
            <span
              ref={(n) => {
                valueRefs.current[i] = n;
              }}
              className={
                l.kind === "locked"
                  ? "text-muted"
                  : "text-signal-dim transition-colors duration-300 group-data-[resolved=true]:text-ink"
              }
            >
              {reduced ? l.value : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
