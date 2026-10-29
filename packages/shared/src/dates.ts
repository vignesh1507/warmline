/** Date helpers for the agenda and for reminder scheduling. */

const MS_PER_DAY = 86_400_000;

export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** Whole days from today until `date`; negative once it's past. */
export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / MS_PER_DAY);
}

/**
 * For a recurring (annual) event, the next time it comes round — today counts as
 * next. Non-recurring events are returned as they are, even once past, so the app
 * can still ask how it went.
 *
 * 29 February on a common year lands on 28 February rather than drifting into March.
 */
export function nextOccurrence(date: Date, recurring: boolean, now: Date = new Date()): Date {
  if (!recurring) return startOfDay(date);
  const today = startOfDay(now);
  const month = date.getMonth();
  const day = date.getDate();
  for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
    const candidate = clampToMonth(year, month, day);
    if (candidate.getTime() >= today.getTime()) return candidate;
  }
  return clampToMonth(today.getFullYear() + 1, month, day);
}

function clampToMonth(year: number, month: number, day: number): Date {
  const lastOfMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastOfMonth), 0, 0, 0, 0);
}

/** Reminders land at 09:00 local, `offsetDays` before the event. */
export const REMINDER_HOUR = 9;

export function reminderDueAt(eventDate: Date, offsetDays: number): Date {
  const due = addDays(startOfDay(eventDate), -offsetDays);
  due.setHours(REMINDER_HOUR, 0, 0, 0);
  return due;
}

export type AgendaBucket = "TODAY" | "THIS_WEEK" | "LATER" | "PAST";

export function agendaBucket(date: Date, now: Date = new Date()): AgendaBucket {
  const days = daysUntil(date, now);
  if (days < 0) return "PAST";
  if (days === 0) return "TODAY";
  if (days <= 7) return "THIS_WEEK";
  return "LATER";
}

export function formatDay(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long" });
}

export function formatRelative(date: Date, now: Date = new Date()): string {
  const days = daysUntil(date, now);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days <= 13) return `in ${days} days`;
  if (days <= 60) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30)} months`;
}

/** An ISO date (yyyy-mm-dd) parsed as local midnight, not UTC. */
export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
