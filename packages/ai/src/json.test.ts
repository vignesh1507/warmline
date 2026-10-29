import { describe, expect, it } from "vitest";
import { extractJson, extractJsonCandidates, JsonParseError } from "./json";

describe("extractJson", () => {
  it("reads plain JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("reads JSON inside a code fence", () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("reads JSON wrapped in chat", () => {
    expect(extractJson('Here you go: {"a":[1,2]} — hope that helps')).toEqual({ a: [1, 2] });
  });

  it("handles braces inside strings", () => {
    expect(extractJson('{"text":"a } brace","ok":true}')).toEqual({ text: "a } brace", ok: true });
  });

  it("throws when there is no JSON at all", () => {
    expect(() => extractJson("I am afraid I cannot do that")).toThrow(JsonParseError);
  });
});

describe("answers from a model that thinks out loud", () => {
  it("offers the last JSON object first, not the echoed template", () => {
    const reply = `Let me work through this.
*   The shape I was asked for: {"gifts":[{"text":"","groundedOn":[]}],"questions":[]}
*   Nisha loves dark chocolate (note-abc).

Here is my answer:
{"gifts":[{"text":"Dark chocolate","groundedOn":["note-abc"]}],"questions":[]}`;

    const candidates = extractJsonCandidates(reply) as { gifts: { text: string }[] }[];
    // The real answer comes first; the empty template is still available behind it.
    expect(candidates[0]!.gifts[0]!.text).toBe("Dark chocolate");
    expect(candidates.length).toBeGreaterThan(1);
  });

  it("prefers a fenced block at the end over earlier prose", () => {
    const reply = 'thinking: {"a":0}\n\n```json\n{"a":42}\n```';
    expect((extractJsonCandidates(reply)[0] as { a: number }).a).toBe(42);
  });

  it("returns nothing to try when there is no JSON", () => {
    expect(extractJsonCandidates("I could not work that out")).toEqual([]);
  });
});
