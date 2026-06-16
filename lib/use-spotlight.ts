"use client";

import { useEffect, useRef } from "react";

/**
 * Desktop-only cursor spotlight. Writes --mx/--my CSS vars on pointer move so a
 * CSS radial-gradient can follow the cursor (CSS owns the paint — no rAF loop).
 *
 * Pure progressive enhancement: listeners are NOT attached on touch / coarse
 * pointers, and the paired CSS only reveals the glow under
 * `(hover:hover) and (pointer:fine)`. On mobile this simply does nothing —
 * never a broken or empty state.
 */
export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
    };

    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, []);

  return ref;
}
