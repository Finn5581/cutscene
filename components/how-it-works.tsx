"use client";

import { motion } from "framer-motion";

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

const item = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export function HowItWorks() {
  return (
    <section
      id="how"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-24 sm:px-10"
    >
      <p className="kicker">How it works</p>

      <motion.ol
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-90px" }}
        variants={{ show: { transition: { staggerChildren: 0.12 } } }}
        className="mt-10"
      >
        {STEPS.map((s) => (
          <motion.li
            key={s.n}
            variants={item}
            className="rule grid grid-cols-[auto_1fr] items-start gap-x-7 py-9 sm:grid-cols-[9rem_1fr] sm:gap-x-14"
          >
            <span
              className="font-display font-bold leading-none text-gold/85"
              style={{ fontSize: "clamp(2.6rem, 6vw, 5rem)" }}
            >
              {s.n}
            </span>
            <div className="pt-1 sm:pt-3">
              <h3
                className="font-display font-bold text-ink"
                style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)" }}
              >
                {s.title}
              </h3>
              <p className="mt-3 max-w-xl text-lg leading-relaxed text-muted">
                {s.body}
              </p>
            </div>
          </motion.li>
        ))}
      </motion.ol>
    </section>
  );
}
