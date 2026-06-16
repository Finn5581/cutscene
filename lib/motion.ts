import type { Transition, Variants } from "framer-motion";

/** Three shared curves — reused everywhere. Ad-hoc per-element easing is the vibecoded tell. */
export const enter: Transition = { duration: 0.45, ease: [0.16, 1, 0.3, 1] };
export const exit: Transition = { duration: 0.2, ease: [0.42, 0, 1, 1] };
export const springy: Transition = { type: "spring", visualDuration: 0.4, bounce: 0.2 };

export const revealUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: enter },
};

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
