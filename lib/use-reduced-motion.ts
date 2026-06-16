"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe prefers-reduced-motion. Defaults to `true` (reduced) so we never
 * flash motion before hydration or on low-end/no-JS paths.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}
