import { isValidEmail } from "@/lib/validation";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const email = String((body as { email?: unknown }).email ?? "");

  if (!isValidEmail(email)) {
    return Response.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  // ⚠️ REVIEW-ONLY STUB. This writes to ephemeral process stdout — it is NOT a
  // recoverable signup list. The page is for review, not public email capture.
  //
  // TODO(pre-launch): persist to Supabase — see spec §4.4 HARD GATE.
  //   Before doing this: (1) flip auto-accept (⏵⏵) OFF, (2) write the migration
  //   but DO NOT apply it (flag for review), (3) use Finn's keys via env.
  console.log("[waitlist] signup:", email);

  return Response.json({ ok: true }, { status: 200 });
}
