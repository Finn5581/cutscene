/**
 * Runs once when the Next.js server starts. We use it for the watchdog: it lives in
 * the web process (not the worker), so it still fires if the worker hangs or dies.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startWatchdog } = await import("./lib/watchdog");
  startWatchdog();
}
