# CutScene Phase 0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship a styled, mobile-flawless CutScene landing shell — the "Forensic Terminal" identity, a signature auto-rotating Decode animation, two co-equal CTAs (try the sample / join waitlist), branded states — with a review-only waitlist stub. No real AI, auth, billing, or storage.

**Architecture:** Next.js App Router single landing page. Logic lives in small pure modules in `lib/` (scramble math, demo script, rotation, validation) that are unit-tested; presentation lives in focused client components. Design system is CSS-variable tokens surfaced through Tailwind v4 `@theme`. Motion animates compositor properties only; everything heavy is baked to a static asset or gated behind `prefers-reduced-motion` / `(hover:hover)`.

**Tech Stack:** Next.js (App Router) + TypeScript + Tailwind v4 + Framer Motion. Fonts via `@fontsource` (hermetic). Tests via Vitest + React Testing Library.

**Branch:** all build work on `phase-0-foundation`. Never commit build code to `main`.

**Dependencies to add (approved via this plan):**
- runtime: `framer-motion`, `@fontsource/jetbrains-mono`, `@fontsource/inter`
- dev: `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`
- NOT added: `use-scramble` (we hand-roll; only revisit if hand-roll proves fiddly — flag before installing)

---

## File Structure

```
app/
  layout.tsx              # fonts, metadata, <BackgroundLayer/>, base classes
  page.tsx                # landing: Nav + Hero + HowItWorks + Waitlist
  globals.css             # @import tailwind; @theme tokens; base layer
  api/waitlist/route.ts   # POST stub (logs, review-only)
components/
  background-layer.tsx    # fixed gradient + bloom + grain + scanlines (pointer-events-none)
  nav.tsx                 # wordmark + CTA
  hero.tsx                # wordmark + DecodeReadout + rotation + co-equal CTAs
  decode-readout.tsx      # THE signature reusable component
  waitlist-form.tsx       # email + submit + branded states
  how-it-works.tsx        # 3-step explainer (scroll reveal)
lib/
  tokens.css              # (folded into globals @theme — single source of truth)
  motion.ts               # 3 shared easing curves + spring presets
  scramble.ts             # pure scramble math (tested)
  decode-script.ts        # 2-3 sample decodes + types (tested: under-promise discipline)
  rotation.ts             # nextIndex helper (tested)
  validation.ts           # isValidEmail (tested)
  use-reduced-motion.ts   # SSR-safe prefers-reduced-motion hook
public/
  noise.png               # baked grain tile (~200px), generated once
test setup: vitest.config.ts, vitest.setup.ts
```

---

## Task 1: Scaffold + deps + test harness

**Files:** whole repo init, `vitest.config.ts`, `vitest.setup.ts`, `package.json`

- [ ] **Step 1:** Create the Next app in-place (TS, Tailwind, App Router, no src dir, import alias `@/*`):
  `npx create-next-app@latest . --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-npm --yes`
- [ ] **Step 2:** Install runtime + dev deps:
  `npm i framer-motion @fontsource/jetbrains-mono @fontsource/inter`
  `npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`
- [ ] **Step 3:** Add `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", globals: true, setupFiles: ["./vitest.setup.ts"] },
  resolve: { alias: { "@": resolve(__dirname, ".") } },
});
```
- [ ] **Step 4:** Add `vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```
- [ ] **Step 5:** Add scripts to `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`.
- [ ] **Step 6:** Sanity test `lib/__tests__/smoke.test.ts`:
```ts
import { expect, test } from "vitest";
test("harness works", () => { expect(1 + 1).toBe(2); });
```
- [ ] **Step 7:** Run `npm test` → PASS. Run `npm run build` → succeeds.
- [ ] **Step 8:** Commit: `chore: scaffold next app + vitest harness`.

---

## Task 2: Design tokens + fonts (Forensic Terminal source of truth)

**Files:** `app/globals.css`, `app/layout.tsx`

- [ ] **Step 1:** Replace `app/globals.css` with Tailwind v4 import + `@theme` tokens + base:
```css
@import "tailwindcss";
@import "@fontsource/jetbrains-mono/400.css";
@import "@fontsource/jetbrains-mono/700.css";
@import "@fontsource/inter/400.css";
@import "@fontsource/inter/500.css";

@theme {
  --color-bg: #070708;
  --color-signal: #39ff7a;
  --color-signal-dim: #1f5e38;
  --color-ink: #f2f2f5;
  --color-muted: #8a8a96;
  --font-mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-exit: cubic-bezier(0.42, 0, 1, 1);
}

:root { color-scheme: dark; }
html { -webkit-text-size-adjust: 100%; }
body {
  background:
    radial-gradient(120% 80% at 50% 0%, #0d0f0e 0%, #070708 55%) fixed,
    var(--color-bg);
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-variant-numeric: tabular-nums slashed-zero;
}
*:focus-visible { outline: 2px solid var(--color-signal); outline-offset: 2px; border-radius: 2px; }
@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration:.001ms!important; animation-iteration-count:1!important; transition-duration:.001ms!important; } }
.hud { font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.12em; }
.scanlines::after {
  content:""; position:absolute; inset:0; pointer-events:none;
  background: repeating-linear-gradient(0deg, transparent 0 2px, rgba(0,0,0,.22) 2px 4px);
}
```
- [ ] **Step 2:** In `app/layout.tsx` set `metadata` (title `CutScene — X-ray vision for memes`, description), `lang="en"`, render `<BackgroundLayer/>` (Task 3) before children. Body className: `min-h-dvh antialiased`.
- [ ] **Step 3:** `npm run build` → succeeds; run `npm run dev`, confirm near-black bg + Inter/JetBrains load.
- [ ] **Step 4:** Commit: `feat: forensic-terminal design tokens + fonts`.

---

## Task 3: Background layer + baked grain

**Files:** `public/noise.png`, `components/background-layer.tsx`

- [ ] **Step 1:** Generate a ~200px grain PNG once (node one-off using built-in zlib to emit a noise PNG, or a committed asset). Acceptance: a 200×200 grayscale PNG at `public/noise.png`, ≤20KB. (If generation is fiddly, use a tiny SVG `feTurbulence` rendered ONCE to canvas in a throwaway script and export — never ship the live filter.)
- [ ] **Step 2:** `components/background-layer.tsx` (server component, no JS):
```tsx
export function BackgroundLayer() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 scanlines">
      <div className="absolute inset-0" style={{
        background: "radial-gradient(60% 40% at 50% -5%, rgba(57,255,122,0.06), transparent 70%)" }} />
      <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
           style={{ backgroundImage: "url(/noise.png)", backgroundRepeat: "repeat" }} />
    </div>
  );
}
```
- [ ] **Step 3:** Build + visually confirm bloom + faint grain + scanlines, no perf jank on mobile devtools.
- [ ] **Step 4:** Commit: `feat: background layer with baked grain + scanlines`.

---

## Task 4: Motion presets

**Files:** `lib/motion.ts`

- [ ] **Step 1:** Write `lib/motion.ts`:
```ts
import type { Transition, Variants } from "framer-motion";
export const enter: Transition = { duration: 0.45, ease: [0.16, 1, 0.3, 1] };
export const exit: Transition = { duration: 0.2, ease: [0.42, 0, 1, 1] };
export const springy: Transition = { type: "spring", visualDuration: 0.4, bounce: 0.2 };
export const revealUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: enter },
};
export const stagger: Variants = { show: { transition: { staggerChildren: 0.08 } } };
```
- [ ] **Step 2:** Commit: `feat: shared motion presets`.

---

## Task 5: Reduced-motion hook + rotation helper (TDD)

**Files:** `lib/use-reduced-motion.ts`, `lib/rotation.ts`, `lib/__tests__/rotation.test.ts`

- [ ] **Step 1 (test):** `rotation.test.ts`:
```ts
import { expect, test } from "vitest";
import { nextIndex } from "@/lib/rotation";
test("wraps to 0 at end", () => { expect(nextIndex(2, 3)).toBe(0); });
test("advances", () => { expect(nextIndex(0, 3)).toBe(1); });
test("single item stays", () => { expect(nextIndex(0, 1)).toBe(0); });
```
- [ ] **Step 2:** Run → FAIL (module missing).
- [ ] **Step 3:** `lib/rotation.ts`: `export const nextIndex = (i: number, len: number) => (i + 1) % len;`
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** `lib/use-reduced-motion.ts` (SSR-safe, defaults to reduced=true on server so we never flash motion):
```ts
"use client";
import { useEffect, useState } from "react";
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update(); mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}
```
- [ ] **Step 6:** Commit: `feat: reduced-motion hook + rotation helper`.

---

## Task 6: Decode script + under-promise discipline (TDD)

**Files:** `lib/decode-script.ts`, `lib/__tests__/decode-script.test.ts`

- [ ] **Step 1 (test):** encode the spec's "under-promise" rule as assertions:
```ts
import { expect, test } from "vitest";
import { DECODES } from "@/lib/decode-script";
test("2-3 decodes of distinct formats", () => {
  expect(DECODES.length).toBeGreaterThanOrEqual(2);
  expect(DECODES.length).toBeLessThanOrEqual(3);
  const formats = new Set(DECODES.map(d => d.format));
  expect(formats.size).toBe(DECODES.length);
});
test("every decode has the 5 readout fields", () => {
  for (const d of DECODES) {
    for (const k of ["format","beat","sound","reference","whySpread"] as const) {
      expect(typeof d[k]).toBe("string");
      expect(d[k].length).toBeGreaterThan(0);
    }
  }
});
test("WHY-IT-SPREAD stays under-promised (grounded, short, no fake metrics)", () => {
  for (const d of DECODES) {
    expect(d.whySpread.length).toBeLessThanOrEqual(60);   // short = grounded
    expect(d.whySpread).not.toMatch(/\d+\s*%|\d+[KMB]\s*views|viral|guaranteed/i);
  }
});
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** `lib/decode-script.ts`:
```ts
export interface Decode {
  format: string; beat: string; sound: string; reference: string; whySpread: string;
}
export const DECODES: Decode[] = [
  { format: "deadpan reaction · static-frame", beat: "setup → hard-cut → bathos",
    sound: "trending flip of a calm vocal loop", reference: "dramatic-zoom archetype",
    whySpread: "relatable overconfidence · the turn lands clean" },
  { format: "escalation · rule-of-three", beat: "build → build → break",
    sound: "rising orchestral stab", reference: "slow-clap reveal archetype",
    whySpread: "tension you feel before the payoff" },
  { format: "smug walk-away · text-over", beat: "claim → cut → unbothered exit",
    sound: "lo-fi boom-bap one-shot", reference: "the unbothered-deadpan archetype",
    whySpread: "everyone knows someone this confident" },
];
```
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit: `feat: under-promised sample decode script`.

---

## Task 7: Scramble engine (TDD)

**Files:** `lib/scramble.ts`, `lib/__tests__/scramble.test.ts`

- [ ] **Step 1 (test):** test pure, deterministic resolve math (no timers):
```ts
import { expect, test } from "vitest";
import { resolveAt, NOISE_GLYPHS } from "@/lib/scramble";
test("fully revealed equals target", () => {
  expect(resolveAt("HELLO", 5, () => 0).text).toBe("HELLO");
});
test("zero revealed is all noise, same length, from glyph set", () => {
  const { text } = resolveAt("HELLO", 0, () => 0);
  expect(text).toHaveLength(5);
  for (const ch of text) expect(NOISE_GLYPHS).toContain(ch);
});
test("spaces always pass through", () => {
  expect(resolveAt("A B", 0, () => 0).text[1]).toBe(" ");
});
test("marks which indices are resolved", () => {
  expect(resolveAt("HELLO", 2, () => 0).resolved).toEqual([true,true,false,false,false]);
});
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** `lib/scramble.ts`:
```ts
export const NOISE_GLYPHS = "0123456789ABCDEF";
export interface Frame { text: string; resolved: boolean[]; }
/** Pure: first `count` chars are the target; rest are noise glyphs chosen by `rng` (0..1). */
export function resolveAt(target: string, count: number, rng: () => number): Frame {
  let text = ""; const resolved: boolean[] = [];
  for (let i = 0; i < target.length; i++) {
    const isResolved = i < count;
    resolved.push(isResolved || target[i] === " ");
    if (isResolved || target[i] === " ") text += target[i];
    else text += NOISE_GLYPHS[Math.floor(rng() * NOISE_GLYPHS.length)];
  }
  return { text, resolved };
}
```
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit: `feat: pure scramble resolve engine`.

---

## Task 8: DecodeReadout component (signature) + a11y test

**Files:** `components/decode-readout.tsx`, `components/__tests__/decode-readout.test.tsx`

- [ ] **Step 1 (test):** reduced-motion path renders final text immediately + a11y contract:
```tsx
import { render, screen } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";
import { DecodeReadout } from "@/components/decode-readout";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: true, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
});

const LINES = [{ label: "FORMAT", value: "deadpan reaction" }];

test("reduced motion shows final value immediately", async () => {
  render(<DecodeReadout lines={LINES} />);
  expect(await screen.findByText("deadpan reaction")).toBeInTheDocument();
});
test("exposes full readout to screen readers, hides animation", () => {
  const { container } = render(<DecodeReadout lines={LINES} />);
  expect(container.querySelector('[aria-label*="deadpan reaction"]')).toBeTruthy();
  expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
});
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `components/decode-readout.tsx` (`"use client"`): props `{ lines: {label,value,kind?}[]; replayKey?: number }`. When `useReducedMotion()` is true, render final text statically. Otherwise run a ref-driven scramble per line, Promise-sequenced one line at a time, writing `textContent` via ref (never setState per frame), block caret via CSS class. Container carries `aria-label` of the full readout; the animating spans are `aria-hidden`. Each line: `[ LABEL ]` in `.hud` green + value. NEVER wrap in `aria-live`.
- [ ] **Step 4:** Run → PASS. Build.
- [ ] **Step 5:** Commit: `feat: DecodeReadout signature component`.

---

## Task 9: Hero (wordmark + readout + rotation + co-equal CTAs)

**Files:** `components/hero.tsx`

- [ ] **Step 1:** `components/hero.tsx` (`"use client"`): `CUTSCENE_` mono wordmark with CSS block caret; one-line promise; `<DecodeReadout/>` fed `DECODES[index]` mapped to lines (incl. `[ MATCHED MOMENT ]  [ locked — join waitlist ]`); auto-rotate via `nextIndex` on a timer (paused under reduced-motion); **two co-equal CTAs** in a flex row (stack on mobile), identical visual weight: "Try the sample" (advances + replays readout via `replayKey`) and "Get early access" (scrolls to / focuses waitlist). Use `motion` + `revealUp`/`stagger`.
- [ ] **Step 2:** Build; verify rotation + replay + reduced-motion (final state, no auto-rotate).
- [ ] **Step 3:** Commit: `feat: hero with rotating decode + co-equal CTAs`.

---

## Task 10: Email validation (TDD) + WaitlistForm

**Files:** `lib/validation.ts`, `lib/__tests__/validation.test.ts`, `components/waitlist-form.tsx`

- [ ] **Step 1 (test):** `validation.test.ts`:
```ts
import { expect, test } from "vitest";
import { isValidEmail } from "@/lib/validation";
test.each(["a@b.co","finn5581@gmail.com"])("valid: %s", e => expect(isValidEmail(e)).toBe(true));
test.each(["","nope","a@","a@b","a b@c.co"])("invalid: %s", e => expect(isValidEmail(e)).toBe(false));
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** `lib/validation.ts`:
```ts
export const isValidEmail = (s: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
```
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** `components/waitlist-form.tsx` (`"use client"`): email input + submit; client-validates with `isValidEmail`; on submit `POST /api/waitlist`; branded states — idle, submitting, success ("You're on the list. We'll signal you."), error ("That email looks scrambled — try again."). Labelled input, `aria-live="polite"` on the status message (status text only — NOT the scramble).
- [ ] **Step 6:** Build. Commit: `feat: waitlist form + email validation`.

---

## Task 11: Waitlist route stub (TDD) — review-only

**Files:** `app/api/waitlist/route.ts`, `app/api/waitlist/__tests__/route.test.ts`

- [ ] **Step 1 (test):**
```ts
import { expect, test, vi } from "vitest";
import { POST } from "@/app/api/waitlist/route";
const req = (body: unknown) =>
  new Request("http://x/api/waitlist", { method: "POST", body: JSON.stringify(body) });
test("valid email → 200 ok", async () => {
  const res = await POST(req({ email: "finn5581@gmail.com" }));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});
test("invalid email → 400", async () => {
  const res = await POST(req({ email: "nope" }));
  expect(res.status).toBe(400);
});
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** `app/api/waitlist/route.ts`:
```ts
import { isValidEmail } from "@/lib/validation";
export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({ email: "" }));
  if (!isValidEmail(String(email ?? ""))) {
    return Response.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  // REVIEW-ONLY STUB: ephemeral stdout — NOT a recoverable signup list.
  // TODO(pre-launch): persist to Supabase — see spec §4.4 hard gate.
  //   Before this: flip auto-accept OFF, write migration (do not apply), use keyed env.
  console.log("[waitlist] signup:", email);
  return Response.json({ ok: true }, { status: 200 });
}
```
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit: `feat: review-only waitlist route stub`.

---

## Task 12: Nav + HowItWorks + page assembly + scroll reveals

**Files:** `components/nav.tsx`, `components/how-it-works.tsx`, `app/page.tsx`

- [ ] **Step 1:** `components/nav.tsx`: `CUTSCENE_` wordmark left; right = muted "How it works" anchor + "Get early access" CTA. Mobile: CTA stays, anchor collapses.
- [ ] **Step 2:** `components/how-it-works.tsx`: 3 steps (Decode the beat → Write the line → Match the moment) as HUD cards; reveal on scroll using CSS `animation-timeline: view()` wrapped in `@supports` + reduced-motion (final state otherwise).
- [ ] **Step 3:** `app/page.tsx`: `<Nav/> <Hero/> <HowItWorks/> <WaitlistForm/>` in a `<main>` with the legal-aware footer microcopy (no clip claims).
- [ ] **Step 4:** Build; verify full page on desktop + mobile viewport.
- [ ] **Step 5:** Commit: `feat: nav, how-it-works, page assembly`.

---

## Task 13: Desktop-only pointer flourish (pure progressive enhancement)

**Files:** `components/hero.tsx` (CTA), `app/globals.css`

- [ ] **Step 1:** Add a CSS-var spotlight on the primary CTA: `pointermove` writes `--mx/--my`; a `radial-gradient` reads them. Gate ALL of it behind `@media (hover:hover) and (pointer:fine)`; in JS, bail early if `!window.matchMedia("(hover:hover)").matches` so listeners aren't attached on touch.
- [ ] **Step 2:** Verify on touch emulation: effect simply absent, layout intact, no errors. (Progressive enhancement — base design complete without it.)
- [ ] **Step 3:** Commit: `feat: desktop-only spotlight CTA (progressive enhancement)`.

---

## Task 14: A11y + mobile + perf pass, then Phase 0 Definition-of-Done

**Files:** as needed

- [ ] **Step 1:** Keyboard pass: tab through nav → CTAs → waitlist; visible `--signal` focus rings; logical order.
- [ ] **Step 2:** Reduced-motion pass: enable OS setting; confirm no auto-rotate, readout shows final text, reveals are instant, full functionality.
- [ ] **Step 3:** Contrast pass: verify `--ink`/`--signal` on `--bg` meet WCAG-AA for text; confirm `--signal-dim` is decorative only.
- [ ] **Step 4:** Mobile pass (375px): co-equal CTAs stack and stay equal-weight; no horizontal scroll; tap targets ≥44px; pointer flourish absent (not broken).
- [ ] **Step 5:** Perf: `npm run build`; confirm no live `feTurbulence`/WebGL; grain is the PNG; rAF loops stop when idle; fonts `swap`.
- [ ] **Step 6:** Full `npm test` green + clean `npm run build`.
- [ ] **Step 7:** Commit: `chore: phase 0 a11y/mobile/perf pass`.
- [ ] **Step 8:** Open PR `phase-0-foundation` → `main`. **STOP for Finn's review.** Do not start Phase 1.

---

## Phase 0 — Definition of Done / Phase 0→1 transition checklist

Phase 0 is **done** (and ready for the Phase 1 go/no-go) when ALL are true:

- [ ] Forensic-Terminal identity renders: `CUTSCENE_` wordmark, near-black + single phosphor accent, mono HUD + Inter, grain + scanlines.
- [ ] DecodeReadout rotates **2–3 under-promised** sample decodes of distinct formats; "Try the sample" replays; scene-match shows the locked teaser (no fake library).
- [ ] Two **co-equal** CTAs render at equal weight (desktop row, mobile stack).
- [ ] Waitlist posts to the **review-only stub**; success/error states are branded; `// TODO(pre-launch)` gate marker present in the route.
- [ ] `prefers-reduced-motion` fully honored; keyboard-navigable; WCAG-AA text contrast; visible focus rings.
- [ ] Flawless at 375px; desktop pointer flourish cleanly **absent** (not broken) on touch.
- [ ] No clip fetching/embedding, no scraping, no env/secrets, no applied migrations anywhere.
- [ ] `npm test` green; `npm run build` clean; all work on `phase-0-foundation`, PR open, `main` untouched by build code.

**Explicitly NOT in Phase 0 (Phase 1+):** real meme ingestion (upload/oEmbed/paste), live AI decode, caption Remix Studio, the curated scene library + matcher, legal-recipe module, trend radar, real keyed waitlist storage, auth, billing.

**The honest gate before going public:** the waitlist is review-only. Making the page public to capture real emails requires the §4.4 hard gate (auto-accept OFF, keyed Supabase storage, reviewed migration) FIRST. And the true product go/no-go remains Phase 7: does a faceless meme channel get traction **by hand** — not the polish of this landing page.
```
