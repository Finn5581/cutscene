"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { DECODES } from "@/lib/decode-script";
import { nextIndex } from "@/lib/rotation";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useMagnetic } from "@/lib/use-magnetic";
import { ShotBreakdown } from "@/components/shot-breakdown";

const ROTATE_MS = 5200;

export function Hero() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const accessRef = useMagnetic<HTMLAnchorElement>(0.25);
  const figureRef = useRef<HTMLElement>(null);

  // subtle scroll parallax on the film still (desktop; flattened under reduced motion)
  const { scrollYProgress } = useScroll({
    target: figureRef,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [40, -40]);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(
      () => setIndex((i) => nextIndex(i, DECODES.length)),
      ROTATE_MS,
    );
    return () => clearInterval(id);
  }, [reduced]);

  const advance = useCallback(
    () => setIndex((i) => nextIndex(i, DECODES.length)),
    [],
  );

  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-24 pt-10 sm:px-10 sm:pt-14">
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="kicker"
      >
        A CutScene Production — No. 001
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        className="mt-7 max-w-[16ch] font-display font-bold leading-[0.98] tracking-[-0.02em] text-ink"
        style={{ fontSize: "clamp(2.6rem, 6.4vw, 6rem)" }}
      >
        Every great meme is borrowing a{" "}
        <span className="text-gold">movie&apos;s timing.</span>
      </motion.h1>

      <div className="mt-14 grid items-start gap-x-12 gap-y-12 lg:grid-cols-12">
        {/* left — the pitch */}
        <div className="flex flex-col gap-9 lg:col-span-5">
          <p className="max-w-md text-lg leading-relaxed text-muted">
            CutScene reads a meme the way a producer reads a rough cut — the format,
            the beat, the borrowed reference — then finds the exact movie moment that
            makes your version land.
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <a
              ref={accessRef}
              href="#waitlist"
              className="rounded-full bg-gold px-7 py-4 text-[15px] font-medium text-[#1a1306] transition-colors hover:bg-[#e6bd72]"
            >
              Get early access
            </a>
            <button
              onClick={advance}
              className="link-underline px-1 py-4 text-[15px] text-ink"
            >
              See another breakdown →
            </button>
          </div>

          <p className="text-sm leading-relaxed text-faint">
            Decode · Write · Match. No clip hosting, no scraping — every scene match
            ships a legal way to produce it.
          </p>
        </div>

        {/* right — the proof: a film still + the rotating breakdown */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          <motion.figure
            ref={figureRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.15 }}
            className="group relative aspect-[16/10] overflow-hidden"
          >
            <motion.div
              style={{ y }}
              className="absolute inset-[-12%] bg-cover bg-center transition-transform duration-700 group-hover:scale-[1.04]"
            >
              <div
                className="h-full w-full"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, rgba(20,17,11,0.15), rgba(20,17,11,0.75)), linear-gradient(90deg, rgba(40,28,12,0.35), transparent), url('https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1400&auto=format&fit=crop')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            </motion.div>
            <figcaption className="absolute bottom-4 left-5 z-10 text-xs tracking-[0.18em] text-ink/80">
              <span className="text-gold">●</span>&nbsp; fig. 1 — the held beat, and why it works
            </figcaption>
          </motion.figure>

          <ShotBreakdown decode={DECODES[index]} index={index} total={DECODES.length} />
        </div>
      </div>
    </section>
  );
}
