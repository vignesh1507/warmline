import { describe, expect, it } from "vitest";
import { minimizeNotes, redact } from "./redact";

describe("redact", () => {
  it("removes contact details before anything is sent to a model", () => {
    const out = redact("mail me at maya@example.com or ring +91 98765 43210, see https://x.com/a");
    expect(out).not.toContain("maya@example.com");
    expect(out).not.toContain("98765");
    expect(out).not.toContain("https://");
  });

  it("leaves ordinary text alone", () => {
    expect(redact("She likes gardening and bad coffee")).toBe("She likes gardening and bad coffee");
  });
});

describe("minimizeNotes", () => {
  const note = (id: string, days: number, body = "a note") => ({
    id,
    kind: "MEMORY",
    body,
    createdAt: new Date(Date.now() - days * 86_400_000),
  });

  it("sends the newest notes first and caps how many", () => {
    const notes = [note("old", 100), note("new", 1), note("mid", 10)];
    const minimal = minimizeNotes(notes, { max: 2 });
    expect(minimal.map((n) => n.id)).toEqual(["new", "mid"]);
  });

  it("trims long notes and strips contact details", () => {
    const [minimal] = minimizeNotes([note("n", 1, `call 9876543210 ${"x".repeat(500)}`)], { maxChars: 50 });
    expect(minimal!.body.length).toBeLessThanOrEqual(50);
    expect(minimal!.body).not.toContain("9876543210");
  });
});
