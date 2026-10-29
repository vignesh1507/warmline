/**
 * Suggestions must be traceable to something the user actually wrote.
 *
 * The thing worth preventing is a *fabricated memory*: an idea that claims the
 * authority of the user's notes while citing something that was never written.
 * Those are dropped here, before they can reach a screen.
 *
 * An idea that cites nothing is a different matter — it is just a guess, and a
 * guess is useful as long as it is labelled. Those are kept and marked, rather
 * than thrown away, so the user is not left with an empty page.
 */

export const UNSUPPORTED = "not based on your notes";

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
    // Cites nothing: keep it, but never let it pass as something the user said.
    const assumption = cited.length === 0 ? (item.assumption ?? UNSUPPORTED) : item.assumption;
    kept.push({ ...item, text, groundedOn: resolved, assumption });
  }
  return { kept, dropped };
}

/** All note ids cited across a set of ideas, for the "based on N of your notes" label. */
export function citedNoteIds(items: Groundable[]): string[] {
  const ids = new Set<string>();
  for (const i of items) for (const id of i.groundedOn ?? []) ids.add(id);
  return [...ids];
}
