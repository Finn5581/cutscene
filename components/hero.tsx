"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DECODES } from "@/lib/decode-script";
import { nextIndex } from "@/lib/rotation";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { revealUp, stagger } from "@/lib/motion";
import { DecodeReadout, type ReadoutLine } from "@/components/decode-readout";

const ROTATE_MS = 4600;

export function Hero() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [replayKey, setReplayKey] = useState(0);

  // Auto-rotate through the sample decodes — paused under reduced motion.
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(
      () => setIndex((i) => nextIndex(i, DECODES.length)),
      ROTATE_MS,
    );
    return () => clearInterval(id);
  }, [reduced]);

  const lines = useMemo<ReadoutLine[]>(() => {
    const d = DECODES[index];
    return [
      { label: "FORMAT", value: d.format },
      { label: "BEAT", value: d.beat },
      { label: "SOUND", value: d.sound },
      { label: "REFERENCE", value: d.reference },
      { label: "WHY IT SPREAD", value: d.whySpread },
      { label: "MATCHED MOMENT", value: "[ locked — join waitlist ]", kind: "locked" },
    ];
  }, [index]);

  const tryTheSample = useCallback(() => {
    setIndex((i) => nextIndex(i, DECODES.length));
    setReplayKey((k) => k + 1);
  }, []);

  const toWaitlist = useCallback(() => {
    const el = document.getElementById("waitlist");
    el?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    document.getElementById("waitlist-email")?.focus({ preventScroll: true });
  }, [reduced]);

  return (
    <section className="mx-auto w-full max-w-5xl px-5 pt-16 pb-20 sm:pt-24">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-8"
      >
        <motion.p variants={revealUp} className="hud text-xs text-signal">
          [ meme intelligence ]
        </motion.p>

        <motion.h1
          variants={revealUp}
          className="font-mono text-5xl font-bold tracking-tight sm:text-7xl"
          style={{ letterSpacing: "-0.03em" }}
        >
          <span className="caret">CUTSCENE</span>
        </motion.h1>

        <motion.p
          variants={revealUp}
          className="max-w-xl text-lg text-muted sm:text-xl"
        >
          X-ray vision for memes. We decode <em className="text-ink not-italic">why</em>{" "}
          it&apos;s funny, write you a fresh line that hits the same beat, and match
          the movie moment whose timing makes it land.
        </motion.p>

        {/* The signature decode — auto-rotating sample */}
        <motion.div
          variants={revealUp}
          className="scanlines relative overflow-hidden rounded-xl border border-white/10 bg-black/40 p-5 sm:p-7"
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-signal shadow-[0_0_8px_var(--color-signal)]" />
            <span className="hud text-[10px] text-muted">
              decoding sample · {index + 1}/{DECODES.length}
            </span>
          </div>
          <DecodeReadout lines={lines} replayKey={replayKey} />
        </motion.div>

        {/* Two co-equal CTAs — equal visual weight (row on desktop, stack on mobile) */}
        <motion.div
          variants={revealUp}
          className="flex flex-col gap-3 sm:flex-row sm:gap-4"
        >
          <button
            onClick={tryTheSample}
            className="hud flex-1 rounded-lg border border-signal/60 bg-signal/10 px-6 py-4 text-sm text-signal transition-colors hover:bg-signal/20 active:scale-[0.99]"
          >
            ▶ Try the sample
          </button>
          <button
            onClick={toWaitlist}
            className="hud flex-1 rounded-lg border border-signal/60 bg-signal/10 px-6 py-4 text-sm text-signal transition-colors hover:bg-signal/20 active:scale-[0.99]"
          >
            ◈ Get early access
          </button>
        </motion.div>
      </motion.div>
    </section>
  );
}
