"use client";

import { motion } from "framer-motion";
import { revealUp, stagger } from "@/lib/motion";

const STEPS = [
  {
    n: "01",
    title: "Decode the beat",
    body: "Paste or upload a meme. CutScene reads its anatomy — format, comedic beat, sound, reference, and why it spread.",
  },
  {
    n: "02",
    title: "Write the line",
    body: "Get a fresh caption that hits the same beat, as editable tokens you remix with a tone dial.",
  },
  {
    n: "03",
    title: "Match the moment",
    body: "We point you to the comedic movie moment whose timing lands it — plus a legal way to actually produce it.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-24 sm:px-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-signal">
        [ how it works ]
      </p>

      <motion.ol
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="mt-10"
      >
        {STEPS.map((s) => (
          <motion.li
            key={s.n}
            variants={revealUp}
            className="rule grid grid-cols-[auto_1fr] items-start gap-x-6 py-8 sm:grid-cols-[7rem_1fr] sm:gap-x-12"
          >
            <span
              className="font-mono font-bold leading-none text-signal-dim"
              style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)" }}
            >
              {s.n}
            </span>
            <div className="pt-1 sm:pt-3">
              <h3 className="font-mono text-xl font-bold text-ink sm:text-2xl">
                {s.title}
              </h3>
              <p className="mt-2 max-w-xl leading-relaxed text-muted">{s.body}</p>
            </div>
          </motion.li>
        ))}
      </motion.ol>
    </section>
  );
}
