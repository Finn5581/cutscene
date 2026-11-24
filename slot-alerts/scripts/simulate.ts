/**
 * End-to-end dry run without waiting for a real opening.
 * Creates a test sign-up (unless one exists), pretends two slots just opened, and
 * runs the real dispatch code. Without Twilio/Resend keys the messages are printed;
 * WITH keys they are really sent to SIM_PHONE / SIM_EMAIL, so use your own details.
 *
 *   SIM_PHONE=+13055550123 SIM_EMAIL=you@example.com npm run simulate
 */
import { getDb, randomToken } from "../src/lib/db";
import { dispatchAlerts } from "../src/lib/dispatch";
import { toLocalString } from "../src/lib/time";

const phone = process.env.SIM_PHONE ?? "+13055550100";
const email = process.env.SIM_EMAIL ?? "test@example.com";
const db = getDb();

db.prepare(
  `INSERT INTO signups(name, email, phone, days, windows, sms_consent, token)
   VALUES (?, ?, ?, ?, ?, 1, ?) ON CONFLICT(phone) DO NOTHING`,
).run("Test Person", email, phone, JSON.stringify([0, 1, 2, 3, 4, 5, 6]), JSON.stringify(["11-13", "13-15", "15-17", "17-19"]), randomToken());

// Two fake slots tomorrow at 14:00 and 14:30 local, plus a random minute so reruns
// produce slots the test person hasn't been told about yet.
const tomorrow = toLocalString(new Date(Date.now() + 86400_000)).slice(0, 10);
const m = String(Math.floor(Math.random() * 29)).padStart(2, "0");
const res = await dispatchAlerts([
  { slot: `${tomorrow}T14:${m}`, spots: 1 },
  { slot: `${tomorrow}T15:${m}`, spots: 1 },
]);
console.log("simulate result:", res);
console.log("running dispatch again with the same slots (should alert nobody):", await dispatchAlerts([{ slot: `${tomorrow}T14:${m}`, spots: 1 }]));
