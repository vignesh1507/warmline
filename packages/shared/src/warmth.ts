/**
 * The warmth meter.
 *
 * A relationship's warmth decays from 100 with a half-life equal to the cadence
 * you chose for that person: at `cadenceDays` since you last spoke it sits at 50,
 * at twice the cadence it's 25, and so on. Deliberately deterministic — the model
 * is never asked how close you are to someone.
 */

export type WarmthBand = "WARM" | "COOLING" | "COLD";

export const WARM_MIN = 66;
export const COOLING_MIN = 33;

const MS_PER_DAY = 86_400_000;

/** Whole days between two instants, floored, never negative. */
export function daysSince(since: Date | null | undefined, now: Date = new Date()): number | null {
  if (!since) return null;
  const days = Math.floor((now.getTime() - since.getTime()) / MS_PER_DAY);
  return days < 0 ? 0 : days;
}

export function warmthScore(
  lastContactAt: Date | null | undefined,
  cadenceDays: number,
  now: Date = new Date(),
): number {
  const days = daysSince(lastContactAt, now);
  // Nothing recorded yet: cold, but honestly so — the UI says "no contact recorded".
  if (days === null) return 0;
  const halfLife = cadenceDays > 0 ? cadenceDays : 1;
  const score = 100 * Math.pow(2, -days / halfLife);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function warmthBand(score: number): WarmthBand {
  if (score >= WARM_MIN) return "WARM";
  if (score >= COOLING_MIN) return "COOLING";
  return "COLD";
}

export type Warmth = {
  score: number;
  band: WarmthBand;
  days: number | null;
  label: string;
};

export function warmth(
  lastContactAt: Date | null | undefined,
  cadenceDays: number,
  now: Date = new Date(),
): Warmth {
  const score = warmthScore(lastContactAt, cadenceDays, now);
  const days = daysSince(lastContactAt, now);
  return { score, band: warmthBand(score), days, label: warmthLabel(days) };
}

export function warmthLabel(days: number | null): string {
  if (days === null) return "no contact recorded";
  if (days === 0) return "spoke today";
  if (days === 1) return "spoke yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) {
    const weeks = Math.round(days / 7);
    return `${weeks} weeks ago`;
  }
  const months = Math.round(days / 30);
  if (months < 24) return `${months} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

/** Coldest first — who to reach out to, given everyone's own cadence. */
export function byCoolest<T extends { lastContactAt: Date | null; cadenceDays: number }>(
  people: T[],
  now: Date = new Date(),
): (T & { warmth: Warmth })[] {
  return people
    .map((p) => ({ ...p, warmth: warmth(p.lastContactAt, p.cadenceDays, now) }))
    .sort((a, b) => a.warmth.score - b.warmth.score);
}
