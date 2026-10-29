import { describe, expect, it } from "vitest";
import { agendaBucket, daysUntil, nextOccurrence, parseISODate, reminderDueAt, toISODate } from "./dates";

const NOW = new Date(2026, 9, 29, 15, 0, 0); // 29 October 2026, afternoon

describe("nextOccurrence", () => {
  it("moves an annual date into the future, keeping the day", () => {
    expect(toISODate(nextOccurrence(new Date(2020, 5, 14), true, NOW))).toBe("2027-06-14");
  });

  it("counts today as the next occurrence", () => {
    expect(toISODate(nextOccurrence(new Date(2001, 9, 29), true, NOW))).toBe("2026-10-29");
  });

  it("leaves one-off events where they are, even in the past", () => {
    expect(toISODate(nextOccurrence(new Date(2026, 0, 2), false, NOW))).toBe("2026-01-02");
  });

  it("keeps 29 February in February on a common year", () => {
    const leapDay = new Date(2024, 1, 29);
    expect(toISODate(nextOccurrence(leapDay, true, NOW))).toBe("2027-02-28");
  });
});

describe("reminderDueAt", () => {
  it("lands at 09:00 the chosen number of days before", () => {
    const due = reminderDueAt(new Date(2026, 11, 25), 7);
    expect(toISODate(due)).toBe("2026-12-18");
    expect(due.getHours()).toBe(9);
  });

  it("supports a reminder on the day itself", () => {
    expect(toISODate(reminderDueAt(new Date(2026, 11, 25), 0))).toBe("2026-12-25");
  });
});

describe("agenda buckets", () => {
  it("sorts by how close the date is", () => {
    expect(agendaBucket(new Date(2026, 9, 29), NOW)).toBe("TODAY");
    expect(agendaBucket(new Date(2026, 10, 2), NOW)).toBe("THIS_WEEK");
    expect(agendaBucket(new Date(2026, 11, 2), NOW)).toBe("LATER");
    expect(agendaBucket(new Date(2026, 9, 28), NOW)).toBe("PAST");
  });

  it("measures whole days regardless of the time of day", () => {
    expect(daysUntil(new Date(2026, 9, 30, 1, 0), NOW)).toBe(1);
  });
});

describe("parseISODate", () => {
  it("reads a date as local midnight, not UTC", () => {
    const parsed = parseISODate("2026-06-14");
    expect(parsed?.getHours()).toBe(0);
    expect(parsed?.getDate()).toBe(14);
    expect(parsed?.getMonth()).toBe(5);
  });

  it("rejects nonsense instead of rolling it over", () => {
    expect(parseISODate("2026-02-30")).toBeNull();
    expect(parseISODate("next friday")).toBeNull();
    expect(parseISODate("")).toBeNull();
  });
});
