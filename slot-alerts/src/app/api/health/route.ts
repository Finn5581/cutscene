/**
 * GET /api/health. Returns 200 when the worker has polled successfully within
 * STALE_AFTER_SECONDS (or is still starting), otherwise 503. Point uptime monitors here.
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { healthSnapshot } from "@/lib/watchdog";

export const dynamic = "force-dynamic";

export async function GET() {
  const h = healthSnapshot();
  const { n } = getDb().prepare("SELECT COUNT(*) AS n FROM signups WHERE status = 'active'").get() as { n: number };
  // lastError can contain internal details; keep the public endpoint terse.
  const { lastError: _omit, ...pub } = h;
  return NextResponse.json({ ...pub, activeSignups: n }, { status: h.ok ? 200 : 503 });
}
