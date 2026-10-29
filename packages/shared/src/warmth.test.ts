import { describe, expect, it } from "vitest";
import { byCoolest, daysSince, warmth, warmthBand, warmthLabel, warmthScore } from "./warmth";

const NOW = new Date("2026-06-01T12:00:00");
const daysBefore = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe("warmthScore", () => {
  it("is full at zero days and halves once per cadence", () => {
    expect(warmthScore(NOW, 30, NOW)).toBe(100);
    expect(warmthScore(daysBefore(30), 30, NOW)).toBe(50);
    expect(warmthScore(daysBefore(60), 30, NOW)).toBe(25);
    expect(warmthScore(daysBefore(90), 30, NOW)).toBe(13);
  });

  it("respects each person's own cadence", () => {
    // Two weeks is warm for a monthly rhythm and cold for a weekly one.
    expect(warmthScore(daysBefore(14), 30, NOW)).toBeGreaterThan(70);
    expect(warmthScore(daysBefore(14), 3, NOW)).toBeLessThan(10);
  });

  it("treats no recorded contact as cold rather than guessing", () => {
    expect(warmthScore(null, 30, NOW)).toBe(0);
    expect(warmthLabel(daysSince(null, NOW))).toBe("no contact recorded");
  });

  it("never exceeds its bounds, even with a future date or a silly cadence", () => {
    expect(warmthScore(new Date(NOW.getTime() + 86_400_000), 30, NOW)).toBe(100);
    expect(warmthScore(daysBefore(10), 0, NOW)).toBeGreaterThanOrEqual(0);
    expect(warmthScore(daysBefore(10_000), 30, NOW)).toBe(0);
  });
});

describe("warmthBand", () => {
  it("splits at 66 and 33", () => {
    expect(warmthBand(100)).toBe("WARM");
    expect(warmthBand(66)).toBe("WARM");
    expect(warmthBand(65)).toBe("COOLING");
    expect(warmthBand(33)).toBe("COOLING");
    expect(warmthBand(32)).toBe("COLD");
  });
});

describe("warmth labels", () => {
  it("reads like a person would say it", () => {
    expect(warmth(NOW, 30, NOW).label).toBe("spoke today");
    expect(warmth(daysBefore(1), 30, NOW).label).toBe("spoke yesterday");
    expect(warmth(daysBefore(5), 30, NOW).label).toBe("5 days ago");
    expect(warmth(daysBefore(21), 30, NOW).label).toBe("3 weeks ago");
    expect(warmth(daysBefore(90), 30, NOW).label).toBe("3 months ago");
  });
});

describe("byCoolest", () => {
  it("puts the person most overdue by their own rhythm first", () => {
    const people = [
      { id: "weekly", lastContactAt: daysBefore(10), cadenceDays: 7 },
      { id: "yearly", lastContactAt: daysBefore(100), cadenceDays: 365 },
      { id: "never", lastContactAt: null, cadenceDays: 30 },
    ];
    expect(byCoolest(people, NOW).map((p) => p.id)).toEqual(["never", "weekly", "yearly"]);
  });
});
