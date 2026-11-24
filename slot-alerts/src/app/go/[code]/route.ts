/**
 * Short link used in texts: /go/<code> -> Waitwhile booking page with the slot's day
 * preselected and the person's own details prefilled. Also records the click.
 */
import { NextResponse } from "next/server";
import { bookingPageUrl } from "@/lib/config";
import { getDb, type Signup } from "@/lib/db";
import { bookingDeepLink } from "@/lib/waitwhile";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const db = getDb();
  const row = db
    .prepare("SELECT a.id, a.slots, s.name, s.email, s.phone FROM alerts a JOIN signups s ON s.id = a.signup_id WHERE a.code = ?")
    .get(code) as (Pick<Signup, "name" | "email" | "phone"> & { id: number; slots: string }) | undefined;
  if (!row) return NextResponse.redirect(bookingPageUrl(), 302);

  db.prepare("UPDATE alerts SET clicked_at = COALESCE(clicked_at, ?) WHERE id = ?").run(new Date().toISOString(), row.id);
  const [slot] = JSON.parse(row.slots) as string[];
  return NextResponse.redirect(bookingDeepLink(slot, row), 302);
}
