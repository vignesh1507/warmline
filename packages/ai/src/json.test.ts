import { describe, expect, it } from "vitest";
import { extractJson, JsonParseError } from "./json";

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
