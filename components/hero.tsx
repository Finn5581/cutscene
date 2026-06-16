"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DECODES } from "@/lib/decode-script";
import { nextIndex } from "@/lib/rotation";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useSpotlight } from "@/lib/use-spotlight";
import { revealUp, stagger } from "@/lib/motion";
import { DecodeMonitor } from "@/components/decode-monitor";
import type { ReadoutLine } from "@/components/decode-readout";

const ROTATE_MS = 4600;

export function Hero() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const sampleRef = useSpotlight<HTMLButtonElement>();
  const accessRef = useSpotlight<HTMLButtonElement>();

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
    document
      .getElementById("waitlist")
      ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    document.getElementById("waitlist-email")?.focus({ preventScroll: true });
  }, [reduced]);

  return (
    <section className="mx-auto w-full max-w-6xl px-6 pt-10 pb-24 sm:px-10 sm:pt-16">
      {/* Type-led top: oversized editorial headline */}
      <motion.div variants={stagger} initial="hidden" animate="show">
        <motion.p
          variants={revealUp}
          className="font-mono text-[11px] uppercase tracking-[0.3em] text-signal"
        >
          [ meme intelligence ]
        </motion.p>

        <motion.h1
          variants={revealUp}
          className="mt-6 font-mono font-bold leading-[0.92] tracking-[-0.04em]"
          style={{ fontSize: "clamp(2.75rem, 9vw, 7.5rem)" }}
        >
          <span className="block text-ink">READ THE</span>
          <span className="block">
            <span className="hollow">MEME&apos;S </span>
            <span className="text-signal">DNA</span>
            <span className="caret" aria-hidden />
          </span>
        </motion.h1>
      </motion.div>

      {/* Asymmetric lower row: the ask (left) and the proof (right) */}
      <div className="mt-14 grid items-start gap-x-10 gap-y-10 lg:grid-cols-[5fr_6fr]">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-8"
        >
          <motion.p
            variants={revealUp}
            className="max-w-md text-lg leading-relaxed text-muted"
          >
            Paste a viral meme. CutScene decodes{" "}
            <span className="text-ink">why</span> it&apos;s funny, writes a fresh line
            that hits the same beat, and points you to the movie moment whose timing
            makes it land.
          </motion.p>

          {/* Two co-equal terminal actions — not pills */}
          <motion.div variants={revealUp} className="flex flex-col gap-3 sm:flex-row">
            <button
              ref={sampleRef}
              onClick={tryTheSample}
              className="term-action spotlight relative flex-1 overflow-hidden px-6 py-4 text-xs text-signal"
            >
              ▶ Try the sample
            </button>
            <button
              ref={accessRef}
              onClick={toWaitlist}
              className="term-action spotlight relative flex-1 overflow-hidden px-6 py-4 text-xs text-signal"
            >
              ◈ Get early access
            </button>
          </motion.div>

          <p className="font-mono text-[11px] leading-relaxed text-muted/50">
            No clip hosting. No scraping. Every scene match ships a legal way to
            produce it.
          </p>
        </motion.div>

        <motion.div
          variants={revealUp}
          initial="hidden"
          animate="show"
        >
          <DecodeMonitor
            lines={lines}
            replayKey={replayKey}
            index={index}
            total={DECODES.length}
          />
        </motion.div>
      </div>
    </section>
  );
}
