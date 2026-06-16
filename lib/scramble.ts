export const NOISE_GLYPHS = "0123456789ABCDEF";

export interface Frame {
  text: string;
  resolved: boolean[];
}

/**
 * Pure scramble frame: the first `count` characters of `target` are resolved
 * (shown as-is); the rest render as noise glyphs chosen by `rng` (returns 0..1).
 * Spaces always pass through. Keeping this pure makes the animation testable
 * without timers and lets the component mutate the DOM via ref each frame.
 */
export function resolveAt(target: string, count: number, rng: () => number): Frame {
  let text = "";
  const resolved: boolean[] = [];
  for (let i = 0; i < target.length; i++) {
    const isSpace = target[i] === " ";
    const isResolved = i < count || isSpace;
    resolved.push(isResolved);
    if (isResolved) {
      text += target[i];
    } else {
      text += NOISE_GLYPHS[Math.floor(rng() * NOISE_GLYPHS.length)];
    }
  }
  return { text, resolved };
}
