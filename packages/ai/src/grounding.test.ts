import { describe, expect, it } from "vitest";
import { citedNoteIds, groundItems } from "./grounding";

const NOTES = ["note-1", "note-2"];

describe("groundItems", () => {
  it("keeps an idea that cites a real note", () => {
    const { kept, dropped } = groundItems([{ text: "Seed kit", groundedOn: ["note-1"] }], NOTES);
    expect(kept).toHaveLength(1);
    expect(dropped).toHaveLength(0);
  });

  it("drops an idea whose cited note does not exist — that is a fabricated memory", () => {
    const { kept, dropped } = groundItems(
      [{ text: "She loves scuba diving", groundedOn: ["note-does-not-exist"] }],
      NOTES,
    );
    expect(kept).toHaveLength(0);
    expect(dropped[0]?.reason).toBe("cited notes that do not exist");
  });

  it("strips the invented half of a part-real citation", () => {
    const { kept } = groundItems(
      [{ text: "Gardening book", groundedOn: ["note-1", "invented"] }],
      NOTES,
    );
    expect(kept[0]?.groundedOn).toEqual(["note-1"]);
  });

  it("allows an honest guess, but not a silent one", () => {
    const honest = groundItems([{ text: "A nice card", groundedOn: [], assumption: "general idea" }], NOTES);
    expect(honest.kept).toHaveLength(1);

    const silent = groundItems([{ text: "A nice card", groundedOn: [] }], NOTES);
    expect(silent.kept).toHaveLength(0);
    expect(silent.dropped[0]?.reason).toBe("no note cited and no assumption stated");
  });

  it("drops empty text", () => {
    expect(groundItems([{ text: "   ", groundedOn: ["note-1"] }], NOTES).kept).toHaveLength(0);
  });

  it("collects the note ids actually cited", () => {
    expect(
      citedNoteIds([
        { text: "a", groundedOn: ["note-1"] },
        { text: "b", groundedOn: ["note-1", "note-2"] },
      ]),
    ).toEqual(["note-1", "note-2"]);
  });
});
