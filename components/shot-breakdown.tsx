"use client";

import { motion } from "framer-motion";
import type { Decode } from "@/lib/decode-script";

const ROWS: { label: string; key: keyof Decode }[] = [
  { label: "Format", key: "format" },
  { label: "Beat", key: "beat" },
  { label: "Sound", key: "sound" },
  { label: "Reference", key: "reference" },
  { label: "Why it spread", key: "whySpread" },
];

const row = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
};

/**
 * The "decode", reimagined editorially: a producer's shot breakdown — gold
 * small-caps labels, cream values, hairline rules. Rotates through samples;
 * each change re-staggers the rows in. No terminal, no scramble.
 */
export function ShotBreakdown({
  decode,
  index,
  total,
}: {
  decode: Decode;
  index: number;
  total: number;
}) {
  return (
    <div className="relative border-l-2 border-[var(--line-gold)] bg-bg-2/50 py-7 pl-6 pr-6 sm:pl-9 sm:pr-9">
      <div className="flex items-baseline justify-between">
        <span className="kicker">Shot Breakdown</span>
        <span className="text-xs tracking-[0.2em] text-faint tabular-nums">
          NO. {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </div>

      <motion.dl
        key={index}
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } }}
        className="mt-7"
      >
        {ROWS.map((r) => (
          <motion.div
            key={r.key}
            variants={row}
            className="rule grid grid-cols-[7.5rem_1fr] items-baseline gap-4 py-3.5 first:border-t-0 first:pt-0 sm:grid-cols-[9rem_1fr]"
          >
            <dt className="text-[0.64rem] font-medium uppercase tracking-[0.2em] text-muted">
              {r.label}
            </dt>
            <dd className="text-[15px] leading-snug text-ink sm:text-base">
              {decode[r.key]}
            </dd>
          </motion.div>
        ))}
        <motion.div
          variants={row}
          className="rule grid grid-cols-[7.5rem_1fr] items-baseline gap-4 py-3.5 sm:grid-cols-[9rem_1fr]"
        >
          <dt className="text-[0.64rem] font-medium uppercase tracking-[0.2em] text-muted">
            Matched moment
          </dt>
          <dd className="text-[15px] sm:text-base">
            <a href="#waitlist" className="link-underline text-gold">
              Locked — join the waitlist
            </a>
          </dd>
        </motion.div>
      </motion.dl>
    </div>
  );
}
