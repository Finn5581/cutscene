/**
 * Monitor worker.
 *
 * Every 20-30 s (random jitter) it fetches open slots inside the booking window,
 * logs the poll, records slots that newly opened, and alerts matching sign-ups.
 * On errors it backs off exponentially (honouring Retry-After) and tells the owner
 * if it looks blocked. It never books anything.
 *
 * Run locally with `npm run worker`. In production `npm start` runs it next to the web app.
 */
import { config } from "../src/lib/config";
import { expirePauses, getDb, kvGet, kvSet, prunePolls } from "../src/lib/db";
import { dispatchAlerts } from "../src/lib/dispatch";
import { alertAdmin, resetAdminAlert } from "../src/lib/notify";
import { formatSlot } from "../src/lib/time";
import { HttpError, fetchOpenSlots, type OpenSlot } from "../src/lib/waitwhile";

const db = getDb();
let consecutiveFailures = 0;
let stopping = false;
let lastPrune = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Normal delay between polls: 20-30 s by default. */
function normalDelayMs(): number {
  return rand(config.pollMinSeconds, config.pollMaxSeconds) * 1000;
}

/** Exponential back-off with jitter: ~1 min, 2, 4, 8 ... capped (default 15 min). */
function backoffDelayMs(failures: number, retryAfter: number | null): number {
  const exp = Math.min(config.maxBackoffSeconds, 60 * 2 ** (failures - 1));
  const base = Math.max(exp, retryAfter ?? 0);
  return rand(base, base * 1.25) * 1000;
}

function logPoll(row: { ok: boolean; status?: number; open?: number; fresh?: number; ms: number; error?: string }) {
  db.prepare("INSERT INTO polls(ok, http_status, open_count, new_count, duration_ms, error) VALUES (?, ?, ?, ?, ?, ?)").run(
    row.ok ? 1 : 0,
    row.status ?? null,
    row.open ?? null,
    row.fresh ?? null,
    row.ms,
    row.error ?? null,
  );
  console.log(
    `[poll] ${new Date().toISOString()} ok=${row.ok} open=${row.open ?? "-"} new=${row.fresh ?? "-"} ${row.ms}ms${row.error ? " err=" + row.error : ""}`,
  );
}

/**
 * Compare with the previous poll. A slot is "new" when it is open now but was not
 * open last time. Openings are kept in a history table for the admin page.
 */
function diffOpenings(open: OpenSlot[]): OpenSlot[] {
  const prev = new Set<string>(JSON.parse(kvGet("last_open_slots") ?? "[]"));
  const now = new Set(open.map((o) => o.slot));
  const fresh = open.filter((o) => !prev.has(o.slot));
  const insert = db.prepare("INSERT INTO openings(slot, spots) VALUES (?, ?)");
  for (const o of fresh) insert.run(o.slot, o.spots);
  const closeGone = db.prepare("UPDATE openings SET gone_at = ? WHERE slot = ? AND gone_at IS NULL");
  for (const slot of prev) if (!now.has(slot)) closeGone.run(new Date().toISOString(), slot);
  kvSet("last_open_slots", JSON.stringify([...now]));
  kvSet("current_open_slots", JSON.stringify(open));
  return fresh;
}

async function pollOnce(): Promise<number> {
  const started = Date.now();
  try {
    const open = await fetchOpenSlots();
    const fresh = diffOpenings(open);
    logPoll({ ok: true, status: 200, open: open.length, fresh: fresh.length, ms: Date.now() - started });
    kvSet("last_success_at", new Date().toISOString());

    if (consecutiveFailures >= 3) {
      await alertAdmin("recovered", `Polling recovered after ${consecutiveFailures} failures.`, true);
      resetAdminAlert("blocked");
    }
    consecutiveFailures = 0;
    kvSet("consecutive_failures", "0");

    if (fresh.length) console.log(`[open] new: ${fresh.map((f) => formatSlot(f.slot)).join(", ")}`);
    // Every open slot is considered, not only new ones, so someone who signs up
    // while a slot is still open hears about it. Dedupe stops repeats.
    await dispatchAlerts(open);
    return normalDelayMs();
  } catch (e) {
    consecutiveFailures++;
    kvSet("consecutive_failures", String(consecutiveFailures));
    const err = e as Error;
    const status = e instanceof HttpError ? e.status : undefined;
    const retryAfter = e instanceof HttpError ? e.retryAfterSeconds : null;
    logPoll({ ok: false, status, ms: Date.now() - started, error: err.message.slice(0, 300) });
    kvSet("last_error", `${new Date().toISOString()} ${err.message}`);

    // 403 / 429 suggest we're being blocked or rate limited. Tell the owner promptly.
    if (status === 403 || status === 429) {
      await alertAdmin("blocked", `Waitwhile returned ${status}. Backing off. Check the admin page.`);
    } else if (consecutiveFailures === 3) {
      await alertAdmin("errors", `3 polls in a row failed. Last error: ${err.message}`);
    }
    // 429 / 5xx / network: exponential back-off. Other 4xx: back off too, never hammer.
    return backoffDelayMs(consecutiveFailures, retryAfter);
  }
}

async function main() {
  console.log(
    `[worker] starting: ${config.locationShortName}, window ${config.openHour}:00-${config.closeHour}:00 ${config.timezone}, ` +
      `${config.minNoticeMinutes} min to ${config.maxNoticeDays} days ahead, poll ${config.pollMinSeconds}-${config.pollMaxSeconds}s`,
  );
  kvSet("worker_started_at", new Date().toISOString());

  while (!stopping) {
    expirePauses(); // bring back people whose 14-day "booked" pause is over
    if (Date.now() - lastPrune > 3600_000) {
      prunePolls();
      lastPrune = Date.now();
    }
    kvSet("worker_heartbeat_at", new Date().toISOString());
    const delay = await pollOnce();
    await sleep(delay);
  }
}

// Crash reporting: tell the owner, then exit non-zero so the launcher restarts us.
async function crash(err: unknown) {
  console.error("[worker] crashed", err);
  try {
    await alertAdmin("crash", `Worker crashed: ${(err as Error)?.message ?? String(err)}. Restarting.`);
  } finally {
    process.exit(1);
  }
}
process.on("uncaughtException", crash);
process.on("unhandledRejection", crash);
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    stopping = true;
    process.exit(0);
  });
}

main().catch(crash);
