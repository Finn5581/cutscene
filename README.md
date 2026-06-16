# CutScene

**X-ray vision for memes.** Paste or upload a viral meme → CutScene decodes *why*
it's funny, writes a fresh on-beat caption, and recommends the comedic movie moment
(title + timestamp + the *why*) whose timing makes it land — plus a **legal** way to
produce it. Not a meme-text stamper; the moat is the decode intelligence + a
hand-curated library of comedic film moments.

> **Status:** Phase 0 — identity & foundation (landing shell + waitlist). No live AI,
> auth, billing, or real storage yet. See `docs/superpowers/specs/` and
> `docs/superpowers/plans/` for the full roadmap.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind v4** (CSS-first `@theme` tokens) + **Framer Motion**
- Self-hosted fonts via `@fontsource` (JetBrains Mono + Inter)
- **Vitest** + React Testing Library

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # run the unit/component suite
npm run build    # production build
```

Regenerate the baked grain texture (rarely needed):

```bash
node scripts/gen-noise.cjs   # writes public/noise.png
```

## Design language — "The Screening Room" (editorial / film-house)

Warm near-black (`#14110b`), cream ink (`#ece3d0`), a single gold accent (`#d8a85a`).
Display type is **Zodiak** (high-contrast Didone) + body **General Sans** — both
Fontshare faces, self-hosted via `next/font/local` from `app/fonts/` (no AI-default
Google Fonts: no Inter/Fraunces/Playfair). A24 / Criterion / MUBI register: refined
serif headlines, real cinematic imagery, magazine restraint, tasteful interactivity
(scroll parallax, magnetic CTA, animated underlines). **Mobile-first**, everything
respects `prefers-reduced-motion` and gates pointer effects behind `(hover:hover)`.
Tokens live in `app/globals.css` (`@theme`).

> Earlier "Forensic Terminal" (green-on-black terminal) direction was scrapped — it
> read as AI-generated. See `docs/superpowers/specs/` for history.

## Project layout

```
app/            # layout, landing page, /api/waitlist route
components/      # nav, hero, decode-readout (signature), waitlist, how-it-works
lib/            # tested pure logic: scramble engine, decode script, validation…
scripts/        # gen-noise.cjs (bakes the grain tile)
docs/           # specs + implementation plans
```

## ⚠️ Non-negotiable guardrails (read before building features)

1. **Never** fetch, host, embed, stream, or download copyrighted video/audio. CutScene
   *recommends and analyzes* scenes (title + timestamp + text). It never delivers the clip.
2. **No platform scraping.** Meme ingestion = user upload, official oEmbed/metadata, or
   manual caption paste. Never bypass auth/rate limits.
3. The **scene library is metadata only** (title, timestamp, archetype tags, one-line why).
   No frames, no thumbnails.
4. Every clip reference ships a risk disclaimer + a **"produce it legally"** recipe.
5. The waitlist is currently a **review-only logging stub** — it does *not* store emails.
   Real keyed storage is a gated pre-launch step (see spec §4.4): flip auto-accept off,
   write the migration without applying it, use env keys.

## Workflow

Feature branches → PR → review. Never commit build code straight to `main`. Name any new
dependency before adding it. Don't touch env/secrets/deploy.
