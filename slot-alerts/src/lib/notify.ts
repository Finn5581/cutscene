/**
 * Outbound messages: Twilio SMS, Resend email, and owner (admin) alerts.
 * Uses the providers' REST APIs directly with fetch, so there are no SDKs to keep updated.
 * When a provider's keys are missing, messages are logged instead of sent (handy locally).
 */
import crypto from "node:crypto";
import { config, resendConfigured, twilioConfigured } from "./config";
import { kvGet, kvSet } from "./db";

export interface SendResult {
  ok: boolean;
  /** Provider id on success, or a short error. */
  detail: string;
  /** Twilio error code, e.g. 21610 = recipient replied STOP. */
  code?: number;
}

// --- SMS (Twilio) ---------------------------------------------------------------

export async function sendSms(to: string, body: string): Promise<SendResult> {
  if (!twilioConfigured()) {
    console.log(`[sms:dry-run] to=${to}\n${body}\n`);
    return { ok: true, detail: "dry-run" };
  }
  const form = new URLSearchParams({ To: to, Body: body });
  // A Messaging Service is preferred (handles A2P 10DLC registration, sender pools).
  if (config.twilioMessagingServiceSid) form.set("MessagingServiceSid", config.twilioMessagingServiceSid);
  else form.set("From", config.twilioFromNumber);

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          authorization: "Basic " + Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString("base64"),
          "content-type": "application/x-www-form-urlencoded",
        },
        body: form,
        signal: AbortSignal.timeout(15_000),
      },
    );
    const json = (await res.json().catch(() => ({}))) as { sid?: string; code?: number; message?: string };
    if (!res.ok) return { ok: false, detail: `twilio ${res.status}: ${json.message ?? ""}`.trim(), code: json.code };
    return { ok: true, detail: json.sid ?? "sent" };
  } catch (e) {
    return { ok: false, detail: `twilio error: ${(e as Error).message}` };
  }
}

/**
 * Verify that an inbound webhook really came from Twilio.
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
export function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  if (!config.twilioAuthToken || !signature) return false;
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  const expected = crypto.createHmac("sha1", config.twilioAuthToken).update(data).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// --- Email (Resend) -------------------------------------------------------------

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl?: string;
}): Promise<SendResult> {
  if (!resendConfigured()) {
    console.log(`[email:dry-run] to=${opts.to} subject="${opts.subject}"\n${opts.text}\n`);
    return { ok: true, detail: "dry-run" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${config.resendApiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: config.resendFrom,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        headers: opts.unsubscribeUrl
          ? { "List-Unsubscribe": `<${opts.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
          : undefined,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, detail: `resend ${res.status}: ${json.message ?? ""}`.trim() };
    return { ok: true, detail: json.id ?? "sent" };
  } catch (e) {
    return { ok: false, detail: `resend error: ${(e as Error).message}` };
  }
}

// --- Owner alerts ------------------------------------------------------------------

/**
 * Alert the site owner by SMS (ADMIN_PHONE) and/or Telegram.
 * `kind` throttles repeats: the same kind is sent at most once per cooldown.
 * Pass `force` for one-off events that must always go out (e.g. recovery notices).
 */
export async function alertAdmin(kind: string, message: string, force = false): Promise<void> {
  const key = `admin_alert:${kind}`;
  const last = kvGet(key);
  const cooldownMs = config.adminAlertCooldownMinutes * 60_000;
  if (!force && last && Date.now() - Date.parse(last) < cooldownMs) return;
  kvSet(key, new Date().toISOString());

  const text = `[slot-alerts] ${message}`;
  console.warn(`[admin-alert:${kind}] ${message}`);
  const tasks: Promise<unknown>[] = [];
  if (config.adminPhone) tasks.push(sendSms(config.adminPhone, text));
  if (config.telegramBotToken && config.telegramChatId) {
    tasks.push(
      fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: config.telegramChatId, text }),
        signal: AbortSignal.timeout(10_000),
      }).catch((e) => console.error("telegram failed", e)),
    );
  }
  await Promise.allSettled(tasks);
}

/** Clear a throttle so the next alert of this kind goes out immediately. */
export function resetAdminAlert(kind: string): void {
  kvSet(`admin_alert:${kind}`, "1970-01-01T00:00:00.000Z");
}
