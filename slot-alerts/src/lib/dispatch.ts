/**
 * Turn a poll result into alerts.
 *
 * Rules:
 *  - A person gets an alert for an open slot that matches their days/times and that
 *    they have never been told about (dedupe in `alerted_slots`, forever).
 *  - One message per person per poll. The earliest slot is the headline (first line);
 *    other new matching slots are listed underneath.
 *  - At most MAX_ALERTS_PER_PERSON_PER_DAY messages per person per local day.
 *  - Everyone who matches is messaged at the same time: all SMS fire in parallel first,
 *    then all emails in parallel. Speed matters, since slots go in seconds.
 */
import { config } from "./config";
import { getDb, randomToken, type Signup } from "./db";
import { sendEmail, sendSms } from "./notify";
import { parseList, slotMatches } from "./prefs";
import { formatSlot, formatTime, localDay } from "./time";
import type { OpenSlot } from "./waitwhile";

interface PlannedAlert {
  signup: Signup;
  slots: string[];
  code: string;
  alertId: number;
}

/** Links that go in messages. Short links keep SMS to one or two segments. */
export const links = {
  go: (code: string) => `${config.publicBaseUrl}/go/${code}`,
  booked: (token: string) => `${config.publicBaseUrl}/b/${token}`,
  unsubscribe: (token: string) => `${config.publicBaseUrl}/u/${token}`,
  /** RFC 8058 one-click endpoint, used in the List-Unsubscribe email header. */
  oneClick: (token: string) => `${config.publicBaseUrl}/api/unsubscribe/${token}`,
};

/** SMS text. Line 1 is always the date and time, as requested. */
export function smsBody(slots: string[], code: string, token: string): string {
  const [first, ...rest] = slots;
  const lines = [`${formatSlot(first)} open at ${config.locationLabel}`, `Book now: ${links.go(code)}`];
  if (rest.length) lines.push(`Also open: ${rest.slice(0, 3).map(formatSlot).join("; ")}`);
  lines.push(`Booked it? Tap: ${links.booked(token)}`, "Reply STOP to opt out");
  return lines.join("\n");
}

function emailContent(s: Signup, slots: string[], code: string) {
  const [first, ...rest] = slots;
  const subject = `${formatSlot(first)} just opened at ${config.locationLabel}`;
  const other = rest.length ? `Also open: ${rest.map(formatSlot).join(", ")}.` : "";
  const text = [
    `Hi ${s.name.split(" ")[0]},`,
    ``,
    `${formatSlot(first)} just opened at ${config.locationLabel}. Slots go within seconds.`,
    `Book it yourself here (your details are prefilled): ${links.go(code)}`,
    other,
    ``,
    `Booked it? Let us know and we'll pause alerts for ${config.bookedPauseDays} days: ${links.booked(s.token)}`,
    `Unsubscribe: ${links.unsubscribe(s.token)}`,
  ].join("\n");
  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#111">
      <p style="font-size:20px;font-weight:600;margin:0 0 12px">${formatSlot(first)} just opened</p>
      <p>A slot at ${config.locationLabel} just opened. They go within seconds.</p>
      <p><a href="${links.go(code)}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Book ${formatTime(first)} now</a></p>
      ${other ? `<p>${other}</p>` : ""}
      <p style="font-size:14px;color:#555">Your name, email and phone are prefilled. You finish the booking on Waitwhile.</p>
      <p style="font-size:14px"><a href="${links.booked(s.token)}">I booked it</a> (pauses alerts for ${config.bookedPauseDays} days) ·
      <a href="${links.unsubscribe(s.token)}">Unsubscribe</a></p>
    </div>`;
  return { subject, text, html };
}

/**
 * Work out who should hear about which of the currently open slots, record it
 * (before sending, so a crash can never cause a duplicate), then send everything.
 */
export async function dispatchAlerts(open: OpenSlot[]): Promise<{ people: number }> {
  if (open.length === 0) return { people: 0 };
  const db = getDb();
  const today = localDay();
  const openSlots = open.map((o) => o.slot);

  const signups = db
    .prepare("SELECT * FROM signups WHERE status = 'active' AND sms_consent = 1 ORDER BY id")
    .all() as unknown as Signup[];
  const alreadyTold = db.prepare("SELECT 1 FROM alerted_slots WHERE signup_id = ? AND slot = ?");
  const sentToday = db.prepare("SELECT COUNT(*) AS n FROM alerts WHERE signup_id = ? AND local_day = ?");
  const insertAlert = db.prepare("INSERT INTO alerts(signup_id, code, slots, local_day) VALUES (?, ?, ?, ?)");
  const insertTold = db.prepare("INSERT OR IGNORE INTO alerted_slots(signup_id, slot) VALUES (?, ?)");
  const markOpening = db.prepare("UPDATE openings SET alerted = 1 WHERE slot = ? AND gone_at IS NULL");

  // 1. Plan (first come, first served order, though everyone is sent at once).
  const plan: PlannedAlert[] = [];
  db.exec("BEGIN");
  try {
    for (const s of signups) {
      const days = parseList<number>(s.days);
      const windows = parseList<string>(s.windows);
      const fresh = openSlots.filter((slot) => slotMatches(slot, days, windows) && !alreadyTold.get(s.id, slot));
      if (fresh.length === 0) continue;
      const { n } = sentToday.get(s.id, today) as { n: number };
      if (n >= config.maxAlertsPerPersonPerDay) continue;

      const code = randomToken(6);
      const res = insertAlert.run(s.id, code, JSON.stringify(fresh), today);
      // Dedupe on every slot we mention, so nobody hears about the same slot twice.
      for (const slot of fresh) {
        insertTold.run(s.id, slot);
        markOpening.run(slot);
      }
      plan.push({ signup: s, slots: fresh, code, alertId: Number(res.lastInsertRowid) });
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  if (plan.length === 0) return { people: 0 };

  const setSms = db.prepare("UPDATE alerts SET sms_status = ? WHERE id = ?");
  const setEmail = db.prepare("UPDATE alerts SET email_status = ? WHERE id = ?");
  const unsubscribe = db.prepare("UPDATE signups SET status = 'unsubscribed' WHERE id = ?");

  // 2. All SMS at once.
  const smsResults = await Promise.all(
    plan.map((p) => sendSms(p.signup.phone, smsBody(p.slots, p.code, p.signup.token))),
  );
  smsResults.forEach((r, i) => {
    setSms.run(r.ok ? `sent ${r.detail}` : `failed ${r.detail}`, plan[i].alertId);
    // 21610: the number replied STOP at the carrier level. Respect it everywhere.
    if (r.code === 21610) unsubscribe.run(plan[i].signup.id);
  });

  // 3. Then all emails at once.
  const emailPlan = plan.filter((p, i) => p.signup.email_alerts && smsResults[i].code !== 21610);
  const emailResults = await Promise.all(
    emailPlan.map((p) =>
      sendEmail({
        to: p.signup.email,
        ...emailContent(p.signup, p.slots, p.code),
        unsubscribeUrl: links.oneClick(p.signup.token),
      }),
    ),
  );
  emailResults.forEach((r, i) => setEmail.run(r.ok ? `sent ${r.detail}` : `failed ${r.detail}`, emailPlan[i].alertId));

  const failed = smsResults.filter((r) => !r.ok).length;
  console.log(`[dispatch] alerted ${plan.length} person(s) (${failed} SMS failed) about ${openSlots.join(", ")}`);
  return { people: plan.length };
}
