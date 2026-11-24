/**
 * Twilio inbound SMS webhook. Set this as the "A message comes in" URL on your number
 * or Messaging Service: <PUBLIC_BASE_URL>/api/twilio/inbound
 *
 * - STOP / UNSUBSCRIBE / CANCEL / END / QUIT / STOPALL / REVOKE / OPTOUT: unsubscribe
 *   in our database. Twilio also blocks further texts and sends the confirmation itself.
 * - START / UNSTOP / YES: re-subscribe.
 * - BOOKED: same as tapping "I booked it" (pauses alerts for 14 days).
 * - HELP is answered by Twilio's built-in reply.
 */
import { config } from "@/lib/config";
import { getDb } from "@/lib/db";
import { verifyTwilioSignature } from "@/lib/notify";

const STOP = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT"]);
const START = new Set(["START", "UNSTOP", "YES"]);

function twiml(message?: string) {
  const body = message ? `<Message>${message.replace(/[<&>]/g, "")}</Message>` : "";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "content-type": "text/xml" },
  });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => (params[k] = String(v)));

  // Validate against the public URL Twilio called (Railway terminates TLS in front of us).
  const url = `${config.publicBaseUrl}/api/twilio/inbound`;
  if (!verifyTwilioSignature(url, params, req.headers.get("x-twilio-signature"))) {
    return new Response("invalid signature", { status: 403 });
  }

  const from = params.From ?? "";
  const word = (params.Body ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  const db = getDb();

  if (STOP.has(word)) {
    db.prepare("UPDATE signups SET status = 'unsubscribed', sms_consent = 0 WHERE phone = ?").run(from);
    return twiml(); // Twilio sends the standard opt-out confirmation
  }
  if (START.has(word)) {
    db.prepare(
      "UPDATE signups SET status = CASE WHEN paused_until > ? THEN 'paused' ELSE 'active' END, sms_consent = 1 WHERE phone = ?",
    ).run(new Date().toISOString(), from);
    return twiml();
  }
  if (word === "BOOKED") {
    const until = new Date(Date.now() + config.bookedPauseDays * 86400_000).toISOString();
    const res = db
      .prepare("UPDATE signups SET status = 'paused', paused_until = ? WHERE phone = ? AND status != 'unsubscribed'")
      .run(until, from);
    return twiml(res.changes ? `Got it. Alerts paused for ${config.bookedPauseDays} days. Enjoy your visit!` : undefined);
  }
  return twiml();
}
