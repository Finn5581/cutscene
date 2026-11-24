/**
 * Watchdog: every minute, check when the worker last completed a successful poll.
 * If that is older than STALE_AFTER_SECONDS (default 5 min), alert the owner.
 */
import { config } from "./config";
import { kvGet } from "./db";
import { alertAdmin, resetAdminAlert } from "./notify";

let started = false;
let wasStale = false;

export function healthSnapshot() {
  const lastSuccess = kvGet("last_success_at");
  const workerStarted = kvGet("worker_started_at");
  const ref = lastSuccess ?? workerStarted;
  const ageSeconds = ref ? Math.round((Date.now() - Date.parse(ref)) / 1000) : null;
  const stale = ageSeconds === null || ageSeconds > config.staleAfterSeconds;
  return {
    ok: !stale,
    status: stale ? "stale" : lastSuccess ? "ok" : "starting",
    lastSuccessfulPoll: lastSuccess,
    secondsSinceLastSuccess: lastSuccess ? Math.round((Date.now() - Date.parse(lastSuccess)) / 1000) : null,
    workerStartedAt: workerStarted,
    workerHeartbeatAt: kvGet("worker_heartbeat_at"),
    consecutiveFailures: Number(kvGet("consecutive_failures") ?? 0),
    lastError: kvGet("last_error"),
  };
}

export function startWatchdog() {
  if (started) return;
  started = true;
  console.log(`[watchdog] started: alerting if no successful poll for ${config.staleAfterSeconds}s`);
  // Give the worker a grace period on boot before judging it.
  const timer = setInterval(async () => {
    try {
      const h = healthSnapshot();
      if (!h.ok) {
        wasStale = true;
        await alertAdmin(
          "stale",
          (h.secondsSinceLastSuccess !== null
            ? `No successful poll for ${Math.round(h.secondsSinceLastSuccess / 60)} min.`
            : `No successful poll since the worker started (${h.workerStartedAt ?? "never started"}).`) +
            ` Last error: ${h.lastError ?? "none"}`,
        );
      } else if (wasStale && h.status === "ok") {
        wasStale = false;
        resetAdminAlert("stale");
        await alertAdmin("stale-recovered", "Polling is healthy again.", true);
      }
    } catch (e) {
      console.error("[watchdog]", e);
    }
  }, 60_000);
  timer.unref();
}
