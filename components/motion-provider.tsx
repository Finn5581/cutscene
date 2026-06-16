"use client";

import { MotionConfig } from "framer-motion";

/**
 * Makes ALL Framer Motion animations honor the OS "reduce motion" setting —
 * transform/opacity animations jump to their end state instead of animating.
 * (The global CSS reduce block only covers CSS animations/transitions; this
 * covers the JS-driven ones.)
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
