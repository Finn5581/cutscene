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
    body: "Get a fresh caption that hits the same beat, as editable tokens you can remix with a tone dial.",
  },
  {
    n: "03",
    title: "Match the moment",
    body: "We point you to the comedic movie moment whose timing lands it — plus a legal way to actually produce it.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto w-full max-w-5xl scroll-mt-20 px-5 py-16">
      <p className="hud mb-8 text-xs text-signal">[ how it works ]</p>
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="grid gap-4 sm:grid-cols-3"
      >
        {STEPS.map((s) => (
          <motion.div
            key={s.n}
            variants={revealUp}
            className="rounded-xl border border-white/10 bg-black/30 p-6"
          >
            <span className="hud text-xs text-signal-dim">{s.n}</span>
            <h3 className="mt-3 font-mono text-lg font-bold text-ink">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
