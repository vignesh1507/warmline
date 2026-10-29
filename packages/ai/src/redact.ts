/**
 * Context minimization. The model needs names and preferences to be useful; it
 * does not need phone numbers, emails, links or card-shaped digit runs, and those
 * are exactly the things that should not be posted to a third-party API.
 */

const PATTERNS: [RegExp, string][] = [
  [/\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/g, "[email]"],
  [/\bhttps?:\/\/\S+/gi, "[link]"],
  [/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[number]"],
  [/\b\d{12,19}\b/g, "[number]"],
];

export function redact(text: string): string {
  let out = text;
  for (const [re, replacement] of PATTERNS) out = out.replace(re, replacement);
  return out;
}

export type MinimalNote = { id: string; kind: string; body: string; createdAt: string };

/**
 * Newest-first, capped in count and length, redacted. Returns what will actually
 * be sent so the UI can show the user the same thing.
 */
export function minimizeNotes(
  notes: { id: string; kind: string; body: string; createdAt: Date }[],
  opts: { max?: number; maxChars?: number } = {},
): MinimalNote[] {
  const { max = 24, maxChars = 320 } = opts;
  return notes
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, max)
    .map((n) => ({
      id: n.id,
      kind: n.kind,
      body: redact(n.body).slice(0, maxChars),
      createdAt: n.createdAt.toISOString().slice(0, 10),
    }));
}
