/**
 * Preferred days and time windows, and matching slots against them.
 */
import { slotWeekdayAndMinutes } from "./time";

export const DAYS = [
  { id: 1, label: "Mon" },
  { id: 2, label: "Tue" },
  { id: 3, label: "Wed" },
  { id: 4, label: "Thu" },
  { id: 5, label: "Fri" },
  { id: 6, label: "Sat" },
  { id: 0, label: "Sun" },
] as const;

/** Two-hour windows across the shop's 11:00-19:00 booking hours. Times are local. */
export const WINDOWS = [
  { id: "11-13", label: "11 AM – 1 PM", start: 11 * 60, end: 13 * 60 },
  { id: "13-15", label: "1 – 3 PM", start: 13 * 60, end: 15 * 60 },
  { id: "15-17", label: "3 – 5 PM", start: 15 * 60, end: 17 * 60 },
  { id: "17-19", label: "5 – 7 PM", start: 17 * 60, end: 19 * 60 },
] as const;

export function parseList<T>(json: string): T[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Does `slot` fall on one of the person's days and inside one of their windows? */
export function slotMatches(slot: string, days: number[], windows: string[]): boolean {
  const { weekday, minutes } = slotWeekdayAndMinutes(slot);
  if (!days.includes(weekday)) return false;
  return WINDOWS.some((w) => windows.includes(w.id) && minutes >= w.start && minutes < w.end);
}

export function describePrefs(days: number[], windows: string[]): string {
  const d = DAYS.filter((x) => days.includes(x.id)).map((x) => x.label);
  const w = WINDOWS.filter((x) => windows.includes(x.id)).map((x) => x.label);
  return `${d.length === 7 ? "Any day" : d.join(", ")} · ${w.length === WINDOWS.length ? "any time" : w.join(", ")}`;
}
