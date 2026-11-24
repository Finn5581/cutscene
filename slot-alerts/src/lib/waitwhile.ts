/**
 * Read-only client for Waitwhile's public availability endpoints.
 * These are the same unauthenticated GETs the booking page makes (see recon/RECON.md).
 * We never call any write endpoint: booking is always done by the person themselves.
 */
import { config } from "./config";
import { localStringToDate, toLocalString } from "./time";

const API = "https://api.waitwhile.com/v2/public/visits";

export interface OpenSlot {
  /** Local wall-clock start, "YYYY-MM-DDTHH:mm". */
  slot: string;
  spots: number;
}

/** Raised for non-2xx responses so the worker can back off appropriately. */
export class HttpError extends Error {
  constructor(public status: number, public retryAfterSeconds: number | null, message: string) {
    super(message);
  }
}

/** Fetch JSON with a timeout and polite, honest headers. */
async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "slot-alerts/0.1 (availability monitor; polls every 20-30s)",
    },
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });
  if (!res.ok) {
    const ra = res.headers.get("retry-after");
    const retryAfter = ra && /^\d+$/.test(ra) ? Number(ra) : null;
    throw new HttpError(res.status, retryAfter, `GET ${new URL(url).pathname} -> ${res.status}`);
  }
  return res.json();
}

/** The booking window we care about: [now + min notice, now + max notice]. */
export function bookingRange(now = new Date()) {
  const from = new Date(now.getTime() + config.minNoticeMinutes * 60_000);
  const to = new Date(now.getTime() + config.maxNoticeDays * 86400_000);
  return { from, to };
}

/** True when a slot is inside the booking window and opening hours. */
export function inWindow(slot: string, now = new Date()): boolean {
  const { from, to } = bookingRange(now);
  const start = localStringToDate(slot);
  if (start < from || start > to) return false;
  const hour = Number(slot.slice(11, 13));
  return hour >= config.openHour && hour < config.closeHour;
}

/** How many spots a raw availability entry has free, honouring TARGET_SERVICE_IDS. */
function freeSpots(entry: Record<string, unknown>): number {
  const byService = (entry.numAvailableSpotsByServiceId ?? {}) as Record<string, number>;
  if (config.targetServiceIds.length > 0) {
    return config.targetServiceIds.reduce((sum, id) => sum + (Number(byService[id]) || 0), 0);
  }
  const total = Number(entry.numAvailableSpots) || 0;
  const serviceMax = Math.max(0, ...Object.values(byService).map((n) => Number(n) || 0));
  return Math.max(total, serviceMax);
}

/**
 * Normalise either endpoint's response into open slots. `availability` returns
 * objects with counts; `first-available-slots` returns slot objects (or, defensively,
 * plain date strings). Entries without counts are assumed to have one free spot.
 */
function parseSlots(data: unknown): OpenSlot[] {
  if (!Array.isArray(data)) return [];
  const out: OpenSlot[] = [];
  for (const item of data) {
    if (typeof item === "string") {
      out.push({ slot: item.slice(0, 16), spots: 1 });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const date = typeof entry.date === "string" ? entry.date.slice(0, 16) : null;
    if (!date) continue;
    const hasCounts = "numAvailableSpots" in entry || "numAvailableSpotsByServiceId" in entry;
    const spots = hasCounts ? freeSpots(entry) : 1;
    if (spots > 0) out.push({ slot: date, spots });
  }
  return out;
}

/**
 * One poll: ask both endpoints for the booking window and merge the results.
 * Two small cached GETs per poll (the API sets s-maxage=10).
 */
export async function fetchOpenSlots(now = new Date()): Promise<OpenSlot[]> {
  const { from, to } = bookingRange(now);
  const qs = `fromDate=${encodeURIComponent(toLocalString(from))}&toDate=${encodeURIComponent(toLocalString(to))}`;
  const base = `${API}/${config.locationShortName}`;

  const first = await getJson(`${base}/first-available-slots?${qs}&maxNumSlots=50`);
  const avail = await getJson(`${base}/availability?${qs}`);

  const merged = new Map<string, OpenSlot>();
  for (const s of [...parseSlots(first), ...parseSlots(avail)]) {
    if (!inWindow(s.slot, now)) continue;
    const prev = merged.get(s.slot);
    merged.set(s.slot, { slot: s.slot, spots: Math.max(prev?.spots ?? 0, s.spots) });
  }
  return [...merged.values()].sort((a, b) => a.slot.localeCompare(b.slot));
}

/**
 * Deep link into the booking page with the day preselected and the person's own
 * details prefilled (the page supports `date`, `firstname`, `lastname`, `email`, `phone`).
 * The person still picks the slot, passes the site's captcha and submits themselves.
 */
export function bookingDeepLink(slot: string, person?: { name: string; email: string; phone: string }): string {
  const url = new URL(`https://waitwhile.com/locations/${config.locationShortName}/time`);
  url.searchParams.set("registration", "booking");
  url.searchParams.set("date", slot);
  if (person) {
    const [first, ...rest] = person.name.trim().split(/\s+/);
    url.searchParams.set("name", person.name.trim());
    url.searchParams.set("firstname", first ?? "");
    if (rest.length) url.searchParams.set("lastname", rest.join(" "));
    url.searchParams.set("email", person.email);
    url.searchParams.set("phone", person.phone);
  }
  return url.toString();
}
