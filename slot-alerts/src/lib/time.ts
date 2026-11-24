/**
 * Time helpers. Waitwhile works in the location's local wall-clock time and
 * formats slots as "YYYY-MM-DDTHH:mm" with no offset, so we do the same.
 */
import { config } from "./config";

type Parts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Wall-clock parts of `date` in the location's timezone. */
export function localParts(date: Date, tz = config.timezone): Parts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    weekday: WEEKDAYS.indexOf(p.weekday),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DDTHH:mm" in local time, the format Waitwhile's API uses. */
export function toLocalString(date: Date, tz = config.timezone): string {
  const p = localParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Local calendar date "YYYY-MM-DD" (used for the per-day alert cap). */
export function localDay(date = new Date(), tz = config.timezone): string {
  return toLocalString(date, tz).slice(0, 10);
}

/** Convert a local "YYYY-MM-DDTHH:mm" string in `tz` to a real Date (handles DST). */
export function localStringToDate(s: string, tz = config.timezone): Date {
  const [d, t = "00:00"] = s.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  const asUtc = Date.UTC(y, mo - 1, da, h, mi);
  // Find the zone offset at that instant, then correct once more for DST edges.
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const p = localParts(new Date(guess), tz);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += asUtc - shown;
  }
  return new Date(guess);
}

/** Parse "YYYY-MM-DDTHH:mm" into weekday (0=Sun) and minutes since midnight. */
export function slotWeekdayAndMinutes(slot: string): { weekday: number; minutes: number } {
  const [d, t] = slot.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  return { weekday: new Date(Date.UTC(y, mo - 1, da)).getUTCDay(), minutes: h * 60 + mi };
}

/** "Fri Nov 27, 2:00 PM" */
export function formatSlot(slot: string): string {
  const [d, t] = slot.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  const date = new Date(Date.UTC(y, mo - 1, da));
  const dayPart = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const h12 = ((h + 11) % 12) + 1;
  return `${dayPart}, ${h12}:${pad(mi)} ${h < 12 ? "AM" : "PM"}`;
}

/** "2:00 PM" */
export function formatTime(slot: string): string {
  return formatSlot(slot).split(", ").pop()!;
}
