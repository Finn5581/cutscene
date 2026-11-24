/**
 * Minimal password protection for /admin.
 * Logging in sets an HttpOnly cookie holding an HMAC derived from SESSION_SECRET;
 * changing SESSION_SECRET or ADMIN_PASSWORD logs everyone out.
 */
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { config } from "./config";

const COOKIE = "admin_session";

function expectedToken(): string {
  const key = config.sessionSecret || config.adminPassword;
  return crypto.createHmac("sha256", key).update(`admin:${config.adminPassword}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function adminEnabled(): boolean {
  return config.adminPassword.length > 0;
}

export async function isAdmin(): Promise<boolean> {
  if (!adminEnabled()) return false;
  const value = (await cookies()).get(COOKIE)?.value;
  return Boolean(value && safeEqual(value, expectedToken()));
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function login(password: string): Promise<boolean> {
  if (!adminEnabled() || !safeEqual(password, config.adminPassword)) return false;
  (await cookies()).set(COOKIE, expectedToken(), {
    httpOnly: true,
    secure: config.publicBaseUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return true;
}

export async function logout(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
