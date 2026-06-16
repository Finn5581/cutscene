export interface Decode {
  format: string;
  beat: string;
  sound: string;
  reference: string;
  /** Kept deliberately short + grounded — under-promise vs. what real Phase 2 AI delivers. */
  whySpread: string;
}

/**
 * Hand-written sample decodes the hero rotates through. Calibrated to output a
 * real LLM vision pass can plausibly produce: short, grounded observations,
 * NO fake metrics or virality predictions. Better the live product exceeds this.
 */
export const DECODES: Decode[] = [
  {
    format: "deadpan reaction · static-frame",
    beat: "setup → hard-cut → bathos",
    sound: "trending flip of a calm vocal loop",
    reference: "dramatic-zoom archetype",
    whySpread: "relatable overconfidence · the turn lands clean",
  },
  {
    format: "escalation · rule-of-three",
    beat: "build → build → break",
    sound: "rising orchestral stab",
    reference: "slow-clap reveal archetype",
    whySpread: "tension you feel before the payoff",
  },
  {
    format: "smug walk-away · text-over",
    beat: "claim → cut → unbothered exit",
    sound: "lo-fi boom-bap one-shot",
    reference: "the unbothered-deadpan archetype",
    whySpread: "everyone knows someone this confident",
  },
];
