# Slot alerts: Chrome Hearts Miami

A small site plus a background worker that watches the public availability of the
[Chrome Hearts Miami Waitwhile booking page](https://waitwhile.com/locations/chromeheartsmiami/time?registration=booking)
and **texts and emails people the moment a slot opens** that matches the days and times they picked.

**It never books anything.** Booking on Waitwhile requires a reCAPTCHA that only a real
person in a real browser can pass (see [`../recon/RECON.md`](../recon/RECON.md)). This app
does not try to get around that. Each alert links to the booking page with the day
preselected and the person's own name, email and phone prefilled, and the person finishes the booking.

## How it works

```
             every 20-30 s (jittered, backs off on errors)
  worker ──► GET first-available-slots + availability (public, read-only)
    │        keep slots 15 min–5 days out, 11:00–19:00 America/New_York
    │        log the poll; diff with the last poll; record new openings
    ▼
  dispatch ─► for each active sign-up: open slots matching their days/times,
    │         not already sent to them, under 5 alerts today
    ▼
  all SMS at once (Twilio) ─► then all emails at once (Resend)

  web (Next.js): sign-up form · /go/<code> deep link · "I booked it" · unsubscribe ·
                 Twilio STOP webhook · /api/health · password-protected /admin · watchdog
```

| Rule | Where |
|---|---|
| Poll every 20–30 s with jitter. Exponential back-off (1 min → 15 min) on 429/5xx/network errors, honouring `Retry-After` | `worker/index.ts` |
| Only slots inside the booking window (15 min–5 days ahead, 11:00–19:00 local) | `src/lib/waitwhile.ts` |
| Never alert the same person about the same slot twice (`alerted_slots` table, written *before* sending) | `src/lib/dispatch.ts` |
| At most 5 alert messages per person per local day (several slots that open together share one message) | `src/lib/dispatch.ts` |
| First line of each text is the date and time | `smsBody()` in `src/lib/dispatch.ts` |
| "I booked it" link pauses that person for 14 days. Texting **BOOKED** does the same | `src/app/b/[token]`, `src/app/api/twilio/inbound` |
| STOP works three ways: Twilio's own carrier-level block, our webhook marking them unsubscribed, and error 21610 on send doing the same | `src/app/api/twilio/inbound`, `src/lib/dispatch.ts` |
| Owner alert if no successful poll for 5 min, if the worker crashes, after 3 failed polls in a row, or on a 403/429 | `src/lib/watchdog.ts`, `worker/index.ts` |

The worker polls around the clock, because cancellations can happen at any hour. It only
ever looks at slots inside the booking window. Each poll is two small GETs that Waitwhile
caches for 10 s.

## Local setup

Requires **Node 22.13+** (the app uses the built-in `node:sqlite`, so there is no native build).

```bash
cd slot-alerts
npm install
cp .env.example .env.local     # set ADMIN_PASSWORD at least
npm run dev                    # site on http://localhost:3000
npm run dev:worker             # in a second terminal: the monitor (reads .env.local)
```

Without Twilio or Resend keys, every text and email is **printed to the console instead of
sent**, so you can try everything safely.

**Try an alert without waiting for a real opening:**

```bash
npm run simulate                                      # dry run: prints the SMS and email
SIM_PHONE=+1305... SIM_EMAIL=you@... npm run simulate # with keys set: really sends to you
```

This creates a test sign-up, pretends two slots opened tomorrow, and runs the real dispatch
code. It also runs dispatch a second time to show that dedupe sends nothing.

Note: `npm run dev` starts only the site, so run the worker separately with `npm run dev:worker`
(both read `.env.local`). In production, `npm start` runs both.

## Environment variables

| Variable | Required | What |
|---|---|---|
| `PUBLIC_BASE_URL` | yes | Your site's public URL, no trailing slash (used in every link and to verify Twilio webhooks). |
| `DB_PATH` | yes on Railway | SQLite file. Use `/data/app.db` with a volume mounted at `/data`. |
| `ADMIN_PASSWORD` | yes | Password for `/admin`. |
| `SESSION_SECRET` | yes | Long random string used to sign the admin cookie (`openssl rand -base64 32`). |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | for SMS | From the Twilio console. |
| `TWILIO_MESSAGING_SERVICE_SID` *or* `TWILIO_FROM_NUMBER` | for SMS | A Messaging Service is recommended. |
| `RESEND_API_KEY`, `RESEND_FROM` | for email | `RESEND_FROM` must use a domain verified in Resend, e.g. `Slot Alerts <alerts@yourdomain.com>`. |
| `ADMIN_PHONE` | recommended | Your mobile number, for worker alerts. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | optional | Also (or instead) send worker alerts to Telegram. |

Optional tuning, with defaults: `TARGET_SERVICE_IDS` (empty means any service; e.g.
`WHmjBONC1Mcf8VSqjWar` = In-store shopping), `MIN_NOTICE_MINUTES=15`, `MAX_NOTICE_DAYS=5`,
`OPEN_HOUR=11`, `CLOSE_HOUR=19`, `POLL_MIN_SECONDS=20`, `POLL_MAX_SECONDS=30`,
`MAX_BACKOFF_SECONDS=900`, `MAX_ALERTS_PER_PERSON_PER_DAY=5`, `BOOKED_PAUSE_DAYS=14`,
`STALE_AFTER_SECONDS=300`, `ADMIN_ALERT_COOLDOWN_MINUTES=30`. Service ids are listed in `../recon/RECON.md`.

## Twilio setup (SMS)

1. Create a Twilio account and buy a US phone number (a local 10DLC number or a toll-free number).
2. **Register it for business texting, or carriers will block your messages.** For a local number
   that is **A2P 10DLC** registration (brand + campaign) under *Messaging → Regulatory Compliance*. For a
   toll-free number it is **Toll-Free Verification**. Approval takes from a few days to a couple of weeks.
   When asked for the opt-in flow, describe the sign-up form: it has an unticked SMS consent box with
   the STOP/HELP wording, and screenshot it.
3. Create a **Messaging Service**, add your number to its sender pool, and copy its SID into
   `TWILIO_MESSAGING_SERVICE_SID`. Copy the Account SID and Auth Token as well.
4. In the Messaging Service, under *Integration → Incoming messages*, choose **Send a webhook** and set it to
   `https://<your-domain>/api/twilio/inbound` (HTTP POST). Keep **Advanced Opt-Out** on (the default).
   Twilio then handles STOP/HELP replies itself, and our webhook mirrors the opt-out in the database.
5. Twilio sends about 1 message per second per local number (more for toll-free). Twilio queues the
   API calls we fire at once, so with many sign-ups add numbers to the sender pool to keep alerts fast.

## Resend setup (email)

1. Create a Resend account, add your domain under *Domains*, and add the DNS records it shows.
2. Create an API key with *Sending access* and put it in `RESEND_API_KEY`.
3. Set `RESEND_FROM` to an address on that domain.

Every email includes an unsubscribe link and a one-click `List-Unsubscribe` header.

## Deploy on Railway

The site and the worker run in **one service**, so they can share the SQLite file on one volume.
`npm start` (`scripts/start.mjs`) starts both and restarts the worker if it crashes.

1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo**, and pick the repo.
3. In the service's **Settings**:
   - **Root Directory**: `slot-alerts`
   - Build and start commands, health check and restart policy come from `railway.json`.
4. **Add a volume**: right-click the service → *Attach volume*, with mount path `/data`.
5. **Variables**: add everything from the table above, including `DB_PATH=/data/app.db`.
6. **Networking → Generate domain** (or add your own). Then set `PUBLIC_BASE_URL` to that `https://…` URL and redeploy.
7. Point Twilio's incoming-message webhook at `https://<domain>/api/twilio/inbound`.
8. Check `https://<domain>/api/health`. It should show `"status":"ok"` within about 30 s. Then log in at `/admin`.

Optional: point a free uptime monitor (UptimeRobot, Better Stack) at `/api/health`. It returns
**503** when the worker hasn't polled successfully for 5 minutes. That covers the case where the
whole service is down, which the built-in watchdog can't report.

## Admin page

`/admin` (password: `ADMIN_PASSWORD`) shows:

- **Worker health**: last successful poll, failures, slots open right now, and whether Twilio/Resend are live.
- **Queue**: every sign-up with their preferences, status (waiting / booked and paused / unsubscribed), alerts today, total alerts and clicks. You can mark someone booked, resume them, or remove them.
- **Recent openings**: each slot that opened, how long it stayed open, and whether anyone was alerted.
- **Recent alerts and recent polls.**

There is no reordering. Everyone who matches a slot is texted at the same moment, so position
doesn't give anyone an advantage.

## Endpoints

| Path | What |
|---|---|
| `/` | Sign-up form |
| `/go/<code>` | Link sent in alerts. Records the click and redirects to Waitwhile with the date and the person's details prefilled |
| `/b/<token>` | "I booked it". GET shows a confirm button and POST pauses alerts for 14 days, so link previews can't trigger it |
| `/u/<token>` | Unsubscribe page (from email) |
| `/api/unsubscribe/<token>` | One-click unsubscribe (POST, used by email clients) |
| `/api/twilio/inbound` | Twilio webhook (signature-verified): STOP / START / BOOKED |
| `/api/health` | JSON health. 200 when OK, 503 when stale |
| `/admin` | Dashboard |

## Code map

```
src/lib/config.ts     env vars and defaults
src/lib/db.ts         SQLite schema + helpers (node:sqlite, WAL)
src/lib/waitwhile.ts  read-only availability client, window filter, deep link
src/lib/dispatch.ts   matching, dedupe, daily cap, parallel SMS then email
src/lib/notify.ts     Twilio / Resend / Telegram over plain fetch; owner alerts
src/lib/watchdog.ts   "no successful poll in 5 min" check (runs in the web process)
src/lib/prefs.ts      day/time preference options and matching
src/lib/time.ts       timezone helpers
worker/index.ts       the polling loop
scripts/start.mjs     production launcher (web + worker)
scripts/simulate.ts   fake an opening to test alerts end to end
```

## Ground rules this app keeps

- It only reads public availability, at a polite rate, with an honest User-Agent.
- It never calls Waitwhile's booking endpoints, and never holds, reserves or books slots.
- It never tries to get past captchas or bot checks.
- People book in their own name. The shop requires matching photo ID and allows one booking per two weeks.
