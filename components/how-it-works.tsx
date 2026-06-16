"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const STEP_MS = 4600;

const STEPS = [
  { n: "01", key: "decode", title: "Decode the beat", blurb: "Read the meme's anatomy" },
  { n: "02", key: "write", title: "Write the line", blurb: "Fresh caption, same beat" },
  { n: "03", key: "match", title: "Match the moment", blurb: "Find the movie timing" },
] as const;

const stage = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
  exit: { opacity: 0, y: -14, transition: { duration: 0.3, ease: [0.42, 0, 1, 1] as const } },
};
const group = { animate: { transition: { staggerChildren: 0.08, delayChildren: 0.12 } } };
const child = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const } },
};

const FILM_IMG =
  "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=900&auto=format&fit=crop";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <motion.div
      variants={child}
      className="rule grid grid-cols-[5rem_1fr] items-baseline gap-3 py-2 first:border-t-0 first:pt-0 sm:grid-cols-[6.5rem_1fr]"
    >
      <dt className="text-[0.6rem] font-medium uppercase tracking-[0.18em] text-muted">
        {label}
      </dt>
      <dd className="text-sm text-ink">{value}</dd>
    </motion.div>
  );
}

function Stage({ k }: { k: string }) {
  if (k === "decode") {
    return (
      <motion.div
        variants={group}
        initial="initial"
        animate="animate"
        className="grid h-full grid-cols-[5.5rem_1fr] items-center gap-5 sm:grid-cols-[8rem_1fr] sm:gap-8"
      >
        <motion.div
          variants={child}
          className="relative aspect-[4/5] overflow-hidden border border-[var(--line)] bg-[#1a150d]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#2a2110] to-[#120e07]" />
          <span className="absolute bottom-2 left-2 text-[0.55rem] uppercase tracking-[0.18em] text-gold">
            ▶ your meme
          </span>
        </motion.div>
        <motion.dl variants={group}>
          <Row label="Format" value="deadpan reaction · static-frame" />
          <Row label="Beat" value="setup → hard-cut → bathos" />
          <Row label="Why" value="relatable overconfidence" />
        </motion.dl>
      </motion.div>
    );
  }

  if (k === "write") {
    const tokens = ["when", "he", "says", "he's", "“5 minutes”", "away"];
    return (
      <motion.div
        variants={group}
        initial="initial"
        animate="animate"
        className="flex h-full flex-col justify-center gap-6"
      >
        <motion.div variants={child} className="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
          Caption · variant 1 of 3
        </motion.div>
        <motion.div variants={group} className="flex flex-wrap gap-2">
          {tokens.map((t, i) => (
            <motion.span
              key={i}
              variants={child}
              className="border border-[var(--line)] bg-bg-2/60 px-3 py-1.5 font-display text-lg text-ink sm:text-xl"
            >
              {t}
            </motion.span>
          ))}
        </motion.div>
        <motion.div variants={child} className="flex items-center gap-3 text-xs text-muted">
          <span className="uppercase tracking-[0.18em]">Dry</span>
          <span className="relative h-px w-32 bg-[var(--line)]">
            <span className="absolute -top-[3px] left-[38%] h-[7px] w-[7px] rounded-full bg-gold" />
          </span>
          <span className="uppercase tracking-[0.18em]">Unhinged</span>
        </motion.div>
      </motion.div>
    );
  }

  // match
  return (
    <motion.div
      variants={group}
      initial="initial"
      animate="animate"
      className="grid h-full grid-cols-[auto_1fr] items-center gap-5 sm:gap-8"
    >
      <motion.div
        variants={child}
        className="relative h-32 w-24 overflow-hidden border border-[var(--line)] sm:h-40 sm:w-32"
      >
        <div
          className="h-full w-full bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(160deg, rgba(216,168,90,0.25), rgba(18,14,7,0.85)), url('${FILM_IMG}')`,
          }}
        />
        <span className="absolute bottom-1.5 left-1.5 text-[0.5rem] tracking-[0.15em] text-ink/80">
          01:42:18
        </span>
      </motion.div>
      <motion.div variants={group}>
        <motion.span variants={child} className="kicker">
          Matched moment
        </motion.span>
        <motion.h4
          variants={child}
          className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl"
        >
          The slow dramatic zoom
        </motion.h4>
        <motion.p variants={child} className="mt-2 text-sm leading-relaxed text-muted">
          Same tension-then-payoff timing as your beat — hold, push in, cut.
        </motion.p>
        <motion.span
          variants={child}
          className="mt-4 inline-block text-sm text-gold"
        >
          ▸ Produce it legally
        </motion.span>
      </motion.div>
    </motion.div>
  );
}

export function HowItWorks() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(
      () => setActive((a) => (a + 1) % STEPS.length),
      STEP_MS,
    );
    return () => clearTimeout(t);
  }, [active, reduced]);

  return (
    <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-24 sm:px-10">
      <p className="kicker">How it works</p>
      <h2
        className="mt-6 max-w-[14ch] font-display font-bold leading-[1.02] tracking-[-0.02em] text-ink"
        style={{ fontSize: "clamp(1.9rem, 4.4vw, 3.4rem)" }}
      >
        Three cuts to a better post.
      </h2>

      {/* The Reel — cinematic stage */}
      <div className="mt-12 overflow-hidden border border-[var(--line)] bg-[#0e0b06]">
        <div className="relative min-h-[300px] px-6 py-12 sm:min-h-[340px] sm:px-12">
          {/* letterbox bars */}
          <span className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-black/60" />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-black/60" />
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              variants={stage}
              initial="initial"
              animate="animate"
              exit="exit"
              className="relative h-full"
            >
              <Stage k={STEPS[active].key} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* film-strip chapter selector */}
        <div className="grid grid-cols-3 border-t border-[var(--line)]">
          {STEPS.map((s, i) => {
            const on = i === active;
            return (
              <button
                key={s.n}
                onClick={() => setActive(i)}
                aria-current={on}
                className={`relative border-l border-[var(--line)] px-4 py-5 text-left transition-colors first:border-l-0 sm:px-6 ${
                  on ? "bg-bg-2/40" : "hover:bg-bg-2/20"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span
                    className={`font-display text-lg font-bold ${on ? "text-gold" : "text-faint"}`}
                  >
                    {s.n}
                  </span>
                </div>
                <div className={`mt-1 font-medium ${on ? "text-ink" : "text-muted"}`}>
                  {s.title}
                </div>
                <div className="mt-0.5 hidden text-xs text-faint sm:block">{s.blurb}</div>
                {on && !reduced && (
                  <motion.span
                    key={`p-${active}`}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: STEP_MS / 1000, ease: "linear" }}
                    className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-gold"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
