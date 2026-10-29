/**
 * Suggestions must be traceable to something the user actually wrote.
 *
 * An idea may either cite notes (`groundedOn`, ids that must resolve) or own up to
 * being a guess (`assumption`). Anything that cites notes which don't exist is a
 * fabricated memory, and gets dropped here before it can reach a screen.
 */

export type Groundable = {
  text: string;
  groundedOn?: string[] | null;
  assumption?: string | null;
};

export type GroundingReport<T> = {
  kept: T[];
  dropped: { item: T; reason: string }[];
};

export function groundItems<T extends Groundable>(items: T[], validNoteIds: Iterable<string>): GroundingReport<T> {
  const valid = new Set(validNoteIds);
  const kept: T[] = [];
  const dropped: { item: T; reason: string }[] = [];

  for (const item of items) {
    const text = (item.text ?? "").trim();
    if (!text) {
      dropped.push({ item, reason: "empty" });
      continue;
    }
    const cited = (item.groundedOn ?? []).filter((id) => typeof id === "string" && id.length > 0);
    const resolved = cited.filter((id) => valid.has(id));

    if (cited.length > 0 && resolved.length === 0) {
      dropped.push({ item, reason: "cited notes that do not exist" });
      continue;
    }
    if (cited.length === 0 && !item.assumption) {
      // Neither grounded nor honest about being a guess.
      dropped.push({ item, reason: "no note cited and no assumption stated" });
      continue;
    }
    kept.push({ ...item, text, groundedOn: resolved });
  }
  return { kept, dropped };
}

/** All note ids cited across a set of ideas, for the "based on N of your notes" label. */
export function citedNoteIds(items: Groundable[]): string[] {
  const ids = new Set<string>();
  for (const i of items) for (const id of i.groundedOn ?? []) ids.add(id);
  return [...ids];
}
