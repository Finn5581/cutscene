# CutScene — Phase 0 Design Spec
*Identity & Foundation*

**Date:** 2026-06-15
**Status:** Draft for review
**Scope:** Phase 0 only (Identity & foundation). Phases 1–7 are out of scope for this spec and get their own spec → plan → build cycle.

> **⚠️ DIRECTION CHANGED (2026-06-15, post-build):** The original "Forensic Terminal"
> direction below (green-on-black, monospace, scanlines) was scrapped after review — it
> read as AI-generated. The live build now uses **"The Screening Room"**: dark editorial /
> film-house (warm black + cream + gold, Zodiak + General Sans, cinematic imagery,
> interactive). The structure, guardrails, co-equal CTAs, under-promise rule, and
> review-only waitlist gate all still hold — only the visual skin changed. Treat §3
> (color/type/texture) as superseded by the Screening Room tokens in `app/globals.css`.

---

## 1. What CutScene is (one breath)

Paste or upload a viral meme → CutScene **reverse-engineers why it's funny**, writes a fresh on-beat caption, and **recommends the movie/scene moment** (title + timestamp + the *why*) whose comedic timing would make your version land harder — plus a **legal recipe** to actually produce it. It is not a meme-text stamper; the moat is *intelligence* (decoding meme format/beat/trend) + a hand-curated library of comedic film moments.

**This spec covers Phase 0 only:** the brand identity and a styled app shell + landing page that already *feels* like the product, with a scripted teaser of the signature "Decode" moment and a working waitlist capture. No real AI, no auth, no billing yet.

---

## 2. Locked decisions (from brainstorming)

| Decision | Value | Notes |
|---|---|---|
| **Name** | **CutScene** | "Cut" = the comedic edit/hard-cut beat; "Scene" = the movie-moment library. |
| **Domain** | **cutscene.io** | Verified available. `.com`/`.app` and IG `@cutscene` are taken. |
| **Social handle** | `@cutscene…` variant | e.g. `@cutscene.app` / `@trycutscene` / `@cutsceneapp` — Finn confirms in-app. Not blocking Phase 0. |
| **Visual direction** | **Forensic Terminal** | Pure-black CRT/decoder console; single phosphor-green accent. Chosen over "Edit-Lab" and "Celluloid". |
| **Phase 0 scope** | **Direction B — Signature-first shell** | Full token system + reusable Decode demo component + waitlist + nav + branded states. (Not thin-shell; not Phase-1 vertical slice.) |
| **Hero CTAs** | **Co-equal** | "Try the sample" demo AND waitlist email capture given equal visual weight — capturing signups is the real Phase 0 goal. |

---

## 3. Design system — "Forensic Terminal"

Everything is **design tokens** (CSS variables surfaced through the Tailwind theme). Zero hardcoded magic values in components.

**Color (one accent, no rainbow terminal soup):**
- `--bg: #070708` (near-black) — layered to defeat banding: `radial-gradient(120% 80% at 50% 0%, #0d0f0e 0%, #070708 55%)`.
- `--signal: #39ff7a` (phosphor green) — the *only* accent. Used for headers, the caret, key readout values, focus rings.
- `--signal-dim: #1f5e38` (resolved-vs-noise contrast in the scramble), `--ink: #f2f2f5` (body text), `--muted: #8a8a96`.
- A faint static phosphor bloom behind the hero via a fixed `radial-gradient(rgba(57,255,122,0.06)…)` — not a blurred DOM node.

**Type:**
- **JetBrains Mono** (one weight, self-hosted woff2, `font-display: swap`) — headers, the wordmark, all HUD labels/readouts. Uppercase + `letter-spacing: 0.12em` + bracket framing (`[ … ]`) for the HUD feel.
- **Inter** (self-hosted) — body/reading text.
- Fluid type via `clamp()` (Utopia-generated scale; always keep a `rem` component so pinch-zoom a11y survives).
- `font-variant-numeric: tabular-nums slashed-zero` on all readouts so updating numbers/timestamps don't wiggle.

**Texture (baked, not live — the mobile-perf rule):**
- Film grain = a pre-rendered ~200px PNG noise tile, `background: url(noise.png) repeat`, `opacity: 0.05`, `mix-blend-mode: overlay`. **No live `feTurbulence` filter** (CPU per-pixel, tanks phones).
- Scanlines = static CSS `repeating-linear-gradient` at **2px+ bands** (1px shimmers on retina). Any moving scan beam animates `transform: translateY()`, never `top`.

**Motion vocabulary (3 curves, reused everywhere — ad-hoc per-element curves are the vibecoded tell):**
- Entrances/reveals: `cubic-bezier(0.16, 1, 0.3, 1)`, 300–500ms.
- Exits/dismiss: ease-in, 150–250ms (shorter than entrances).
- Interactive springs only: `{ type: "spring", visualDuration: 0.4, bounce: 0.2 }`.
- **Animate compositor properties only** (`transform`, `opacity`, `filter`, `clip-path`). This single rule is what keeps it Awwwards-grade *and* mobile-flawless.

---

## 4. The components (Phase 0)

The app is a small set of focused, independently-understandable units.

### 4.1 `DecodeReadout` — the signature, reusable component
The forensic "scan" of a meme that types out its anatomy. **Built as a real, reusable component now** because Phase 2 wires the same component to live AI output — Phase 0 just feeds it a scripted script.

- **Props:** an ordered list of readout lines `{ label, value, kind }` + a play mode (`auto` | `replay`). It does not know whether the data is scripted or real.
- **Animation (studio-grade, not cheesy):**
  - Character reveal / scramble via the canonical scramble algorithm (hex/binary glyph set `0123456789ABCDEF` for the forensic feel). Noise chars rendered dim (`--signal-dim`), resolved chars bright (`--signal`).
  - **Mutate the DOM via ref — never `setState` per frame.** Each readout *line* is its own element; lines resolve one at a time, Promise-sequenced.
  - Block caret: CSS-only `steps(1)` blink (hard snap, no fade), phosphor `box-shadow` bloom.
- **Library decision (named for approval):** `use-scramble` (<1KB, writes via ref, no per-frame re-render) — or hand-roll the soulwire algorithm to avoid the dep. *Default recommendation: hand-roll* to keep Phase 0 dependency-light; fall back to `use-scramble` only if the hand-roll gets fiddly.
- **A11y:** under `prefers-reduced-motion`, render the final decoded text immediately (no scramble) — this doubles as the low-end-device path. Full text in the container's `aria-label`; animating element is `aria-hidden`. **Never** wrap it in `aria-live` (would announce garbage 60×/sec).

### 4.2 The scripted demo content
**2–3 hand-written sample decodes of *different* meme formats** (e.g. a deadpan static-frame reaction, an escalation/bathos cut, a smug walk-away) that the hero **rotates through** — so the demo shows range, not one trick. Each is a separate entry in `lib/decode-script.ts` and the hero cycles them (manual "Try the sample" advances to the next; auto-play rotates on a timer).

**Constraint (Finn):** scripted strictly around output the **real Phase 2 AI can plausibly produce** — and deliberately **under-promised**. In particular, calibrate `WHY IT SPREAD` to the caliber a real LLM vision pass actually delivers: short, grounded, slightly hedged observations ("relatable overconfidence · clean setup→turn"), **not** clairvoyant virality predictions or fake metrics. Better the live product *exceeds* the teaser than disappoints it.

Example shape (final copy TBD during build):
```
[ FORMAT ]        deadpan reaction · static-frame
[ BEAT ]          setup → hard-cut → bathos
[ SOUND ]         <trending audio, described generically>
[ REFERENCE ]     dramatic-zoom archetype
[ WHY IT SPREAD ] relatable overconfidence · the turn lands clean
```
Scene-match line is teased as "matched moment: [locked — join waitlist]" so we don't fake the curated library before it exists.

### 4.3 `Hero`
- `CUTSCENE_` wordmark (mono, blinking caret).
- One-line promise.
- `DecodeReadout` auto-playing the scripted sample.
- **Two co-equal CTAs**, equal visual weight, side by side (stacked on mobile):
  1. **Try the sample** → replays the `DecodeReadout`.
  2. **Get early access** → waitlist email field.
- Respects `prefers-reduced-motion` (final state, no auto-motion).

### 4.4 `WaitlistForm` (stub) — **review-only, NOT public-capture-ready**
- Email input + submit, validates format client-side, posts to a Next route handler `POST /api/waitlist`.
- **The route handler is a logging stub** — validates and `console.log`s the email, returns success. **No Supabase, no env, no secrets touched.**
- **Honest limitation (do not skip):** a `console.log` writes to ephemeral process stdout (your dev terminal; or short-lived runtime logs on a deploy). **Logged emails are NOT recoverable as a usable signup list.** This build is for **Finn's review of the brand**, not for publicly collecting real signups.
- A clearly-marked `// TODO(pre-launch): persist to Supabase — see §4.4 hard gate` marker is left at the exact insertion point.
- Branded success + error states in product voice ("You're on the list. We'll signal you." / "That email looks scrambled — try again.").

> **HARD GATE — before this landing page goes public to capture real emails:**
> wire the real, reviewed, **keyed** Supabase storage step. This is a separate step, NOT part of the Phase 0 styling build. It is the **first** thing that touches env/secrets/DB, so:
> 1. **Flip auto-accept (⏵⏵) OFF** before starting it.
> 2. Write any DB migration but **do not apply it** — flag for Finn's review.
> 3. Use Finn's keys via env, never hardcoded.
> Until this gate is cleared, the page stays review-only.

### 4.5 `Nav` + shell
- Minimal top nav: wordmark left; a single muted link or two (e.g. "How it works" anchor) + the waitlist CTA right. Mobile: collapses cleanly.
- Global background layer (gradient + bloom + grain + scanlines) as a fixed, pointer-events-none layer.

### 4.6 Branded empty/loading states
- Loading: "Reading the meme's DNA…" in the readout voice — never a dead gray box.
- These are tokens/components so Phases 1–6 reuse them.

---

## 5. Craft techniques we'll actually use (research-backed, mobile-first)

Pulled from studio-grade research and **filtered to what survives on a mid-range phone**. The full research lives in the build notes; the shortlist we commit to:

1. **Mono HUD labels + tabular/slashed-zero numerals + `clamp()` fluid type** — zero perf cost, biggest aesthetic payoff per byte. *(JetBrains Mono typography; Utopia clamp.)*
2. **The decode/scramble readout, done right** — direct DOM writes via ref, hex glyph set, dim-noise/bright-resolved, Promise-sequenced one line at a time. *(soulwire TextScramble / use-scramble.)*
3. **Layered near-black + baked PNG grain + static CSS scanlines** — the whole filmic-terminal surface for ~5KB. *(css-tricks grainy gradients / terminal styling.)*
4. **CSS-native `view()` scroll reveals** with the studio easing, wrapped in `@supports` + reduced-motion; Framer `useScroll` only where orchestration is needed. *(developer.chrome.com / WebKit scroll-driven animations.)*
5. **(Optional, desktop-only) spotlight glow + magnetic CTA** via CSS vars, gated behind `@media (hover:hover) and (pointer:fine)` — ~0KB on mobile. *(Frontend Masters CSS spotlight.)* **Pure progressive enhancement:** on touch devices the effects simply don't exist — listeners aren't even attached (matchMedia check), and the layout is visually complete without them. There is **no broken or empty state on mobile** — the flourishes are absent, not unfinished. The base design must stand fully on its own; these only layer on for fine-pointer desktop.

**Explicitly AVOIDED / deferred (tank mid-range phones):**
- Live `feTurbulence` grain / animated `baseFrequency` → **bake to PNG instead.**
- Fullscreen persistent WebGL/OGL shader background (cost scales DPR²) → not needed; CSS+PNG wins here.
- Looping variable-font weight animation, long-pinned (300vh+) scroll sections, per-character Framer stagger over long text.

> **The tension, resolved:** captivating *and* fast. Every motion either animates a compositor property or bakes to a static asset or gates behind `prefers-reduced-motion` / `(hover:hover)`. We are not shipping the whole showreel — just the 4–5 moves that are high-impact *and* cheap on the phones our users actually hold.

---

## 6. Stack & architecture

- **Next.js (App Router) + TypeScript** — scaffold.
- **Tailwind** with a custom token theme (no default gray).
- **Framer Motion** for orchestrated motion (the rest is CSS).
- **Self-hosted fonts** (no external font CDN calls).
- Mobile-first throughout.

**New dependencies (named per guardrail, nothing else added without asking):**
| Package | Why |
|---|---|
| `framer-motion` | The signature orchestrated motion. |
| `@fontsource/jetbrains-mono` | Self-hosted mono (no external calls). |
| `@fontsource/inter` | Self-hosted body font. |
| `use-scramble` *(maybe)* | Only if hand-rolling the scramble proves fiddly. Flagged before install. |

**File shape (indicative):**
```
app/
  layout.tsx            # fonts, global background layer, metadata
  page.tsx              # landing: Hero + how-it-works + waitlist
  api/waitlist/route.ts # logging stub
components/
  decode-readout/       # the signature, reusable
  hero.tsx
  waitlist-form.tsx
  nav.tsx
  background-layer.tsx
lib/
  decode-script.ts      # the scripted sample decode (Phase-2-plausible)
  tokens.css            # CSS variables (source of truth)
  motion.ts             # the 3 shared easing curves / spring presets
```

---

## 7. Non-negotiables carried into Phase 0

Even though Phase 0 has no clips or AI, these are baked into the foundation now:
- **No clip fetching/hosting/embedding ever.** Nothing in Phase 0 touches video. (Guardrail #1.)
- **No platform scraping.** The TikTok reference link Finn shared is treated as context only — never fetched. Ingestion (Phase 1) will be upload / official oEmbed / manual paste. (Guardrail #2.)
- **Scene library is metadata only** — not built in Phase 0, but the data model (title, timestamp, archetype tags, one-line why — *no frames*) is the assumption the Scene-Match teaser is written against. (Guardrail #5.)
- The waitlist teaser must not over-promise capabilities the Phase 2 AI can't deliver.

---

## 8. Accessibility & performance bar (senior-grade)

- WCAG-AA contrast on the dark theme (phosphor-green on near-black verified for text sizes; dim green is decorative only, never sole carrier of meaning).
- Full keyboard nav, visible focus rings (`--signal`), logical tab order.
- `prefers-reduced-motion`: full functionality, motion off, readout shows final state.
- Self-hosted fonts + `font-display: swap`; lazy-load anything heavy; clean up all listeners/rAF loops (stop rAF when idle).
- Target: flawless on a narrow mobile viewport and on a mid-range Android — this is the acceptance bar, not desktop.

---

## 9. Working agreement (guardrails)

- Feature branch, **never commit to main**; open a PR for the Phase 0 build.
- No new npm package without naming it + why first (see §6).
- Don't touch env/secrets/deploy; waitlist stays a logging stub. Any DB migration is written, **not applied** — flagged for review.
- Build the custom interactions by hand — no default component-library defaults shipped as "done."
- After Phase 0: clean build, show what changed, **stop for Finn's review before Phase 1.**

---

## 10. Definition of done (Phase 0)

A visitor lands on the CutScene page and sees something that *looks designed by a studio, not generated from a template*: the `CUTSCENE_` forensic-terminal identity, a signature Decode animation rotating through **2–3 Phase-2-plausible (under-promised) sample decodes** of different formats, two co-equal CTAs (try the sample / join the waitlist), branded empty/loading states, full keyboard + reduced-motion support — fast and flawless on a mid-range phone, with desktop-only pointer flourishes that are cleanly absent (never broken) on touch. The waitlist posts to a **review-only logging stub** (emails not yet recoverable — real keyed storage is a gated pre-launch step, §4.4). A clean production build passes. Then we stop and review.

**Reality check (kept honest):** Phase 0's real deliverable is the **waitlist** and a brand worth signing up for — *not* a finished product. The true go/no-go for building the whole of CutScene remains Phase 7: can a meme channel get traction by hand. The phased plan exists so we can stop cheaply if validation says stop.
