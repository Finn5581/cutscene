"use server";
/**
 * Public server actions: sign up, confirm "I booked it", unsubscribe.
 */
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { config } from "@/lib/config";
import { getDb, randomToken } from "@/lib/db";
import { sendSms } from "@/lib/notify";
import { DAYS, WINDOWS } from "@/lib/prefs";

export type SignupValues = { name: string; email: string; phone: string; days: number[]; windows: string[]; consent: boolean };
/** `values` echoes what was submitted so the form can be refilled after an error. */
export type SignupState = { ok: boolean; message: string; values?: SignupValues } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signup(_prev: SignupState, form: FormData): Promise<SignupState> {
  // Honeypot: real people never fill this hidden field.
  if (form.get("website")) return { ok: true, message: "Thanks!" };

  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const phoneRaw = String(form.get("phone") ?? "").trim();
  const days = form.getAll("days").map(Number).filter((d) => DAYS.some((x) => x.id === d));
  const windows = form.getAll("windows").map(String).filter((w) => WINDOWS.some((x) => x.id === w));
  const smsConsent = form.get("sms_consent") === "on";
  const values: SignupValues = { name, email, phone: phoneRaw, days, windows, consent: smsConsent };
  const fail = (message: string): SignupState => ({ ok: false, message, values });

  if (name.length < 2 || name.length > 100 || !name.includes(" "))
    return fail("Enter your full name (first and last), as it appears on your photo ID.");
  if (!EMAIL_RE.test(email) || email.length > 200) return fail("Enter a valid email address.");
  const phone = parsePhoneNumberFromString(phoneRaw, "US");
  if (!phone || !phone.isValid()) return fail("Enter a valid mobile number.");
  if (days.length === 0) return fail("Pick at least one day.");
  if (windows.length === 0) return fail("Pick at least one time window.");
  if (!smsConsent) return fail("Please agree to receive text alerts. Texts are how the alerts reach you.");

  const e164 = phone.number;
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO signups(name, email, phone, days, windows, sms_consent, token)
       VALUES (?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT(phone) DO UPDATE SET
         name = excluded.name, email = excluded.email, days = excluded.days,
         windows = excluded.windows, sms_consent = 1, email_alerts = 1,
         -- keep an active "I booked it" pause, otherwise (re)activate
         status = CASE WHEN status = 'paused' AND paused_until > ? THEN 'paused' ELSE 'active' END`,
    )
    .run(name, email, e164, JSON.stringify(days), JSON.stringify(windows), randomToken(), now);

  // Confirmation text (also tells carriers/people how to opt out).
  await sendSms(
    e164,
    `You're signed up for ${config.locationLabel} slot alerts. We'll text when a matching slot opens ` +
      `(max ${config.maxAlertsPerPersonPerDay}/day). Msg & data rates may apply. Reply STOP to opt out, HELP for help.`,
  );

  return {
    ok: true,
    message: `You're on the list. We'll text ${phone.formatNational()} the moment a matching slot opens. You'll book it yourself, so keep your phone close.`,
  };
}

/** "I booked it": pause alerts for BOOKED_PAUSE_DAYS (the shop allows 1 booking per 2 weeks). */
export async function confirmBooked(token: string): Promise<{ until: string } | null> {
  const until = new Date(Date.now() + config.bookedPauseDays * 86400_000).toISOString();
  const res = getDb()
    .prepare("UPDATE signups SET status = 'paused', paused_until = ? WHERE token = ? AND status != 'unsubscribed'")
    .run(until, token);
  return res.changes ? { until } : null;
}

export async function unsubscribeToken(token: string): Promise<boolean> {
  const res = getDb().prepare("UPDATE signups SET status = 'unsubscribed', sms_consent = 0 WHERE token = ?").run(token);
  return res.changes > 0;
}
