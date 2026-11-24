/**
 * Production entry point (`npm start`): runs the Next.js web app and the monitor
 * worker side by side in one Railway service, so both share the SQLite volume.
 *
 * - If the worker exits (crash), it is restarted with a growing delay.
 * - If the web server exits, the whole process exits so Railway restarts the service.
 */
import { spawn } from "node:child_process";

// node:sqlite prints an "experimental" warning on every start; it's stable enough for this.
const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--disable-warning=ExperimentalWarning"].filter(Boolean).join(" "),
};
const bin = (name) => new URL(`../node_modules/.bin/${name}`, import.meta.url).pathname;

const web = spawn(bin("next"), ["start", "-p", process.env.PORT ?? "3000"], { stdio: "inherit", env });
web.on("exit", (code) => {
  console.error(`[launcher] web exited (${code}); exiting so the platform restarts us`);
  process.exit(code ?? 1);
});

let restarts = 0;
let worker;
function startWorker() {
  const started = Date.now();
  worker = spawn(bin("tsx"), ["worker/index.ts"], { stdio: "inherit", env });
  worker.on("exit", (code, signal) => {
    if (signal === "SIGTERM" || signal === "SIGINT") return;
    // Reset the restart counter if it had been running fine for 10+ minutes.
    restarts = Date.now() - started > 600_000 ? 1 : restarts + 1;
    const delay = Math.min(60_000, 2_000 * 2 ** (restarts - 1));
    console.error(`[launcher] worker exited (${code}); restarting in ${delay / 1000}s`);
    setTimeout(startWorker, delay);
  });
}
startWorker();

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    worker?.kill(sig);
    web.kill(sig);
    setTimeout(() => process.exit(0), 5_000).unref();
  });
}
