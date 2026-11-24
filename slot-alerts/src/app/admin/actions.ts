"use server";
/** Admin-only actions. Each one re-checks the session. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logout, requireAdmin } from "@/lib/auth";
import { config } from "@/lib/config";
import { getDb } from "@/lib/db";

export async function pauseSignup(id: number) {
  await requireAdmin();
  const until = new Date(Date.now() + config.bookedPauseDays * 86400_000).toISOString();
  getDb().prepare("UPDATE signups SET status = 'paused', paused_until = ? WHERE id = ?").run(until, id);
  revalidatePath("/admin");
}

export async function resumeSignup(id: number) {
  await requireAdmin();
  // Never re-activate someone who opted out. Only they can do that (START or signing up again).
  getDb().prepare("UPDATE signups SET status = 'active', paused_until = NULL WHERE id = ? AND status = 'paused'").run(id);
  revalidatePath("/admin");
}

export async function removeSignup(id: number) {
  await requireAdmin();
  getDb().prepare("DELETE FROM signups WHERE id = ?").run(id); // cascades to their alerts
  revalidatePath("/admin");
}

export async function signOut() {
  await logout();
  redirect("/admin/login");
}
