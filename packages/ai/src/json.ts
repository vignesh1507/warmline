/**
 * Pulling the answer out of a model that thinks out loud.
 *
 * Gemma 4 typically restates the task, echoes the shape it was asked for, plans
 * in bullet points, and only then emits the real JSON. That means the *first*
 * JSON-looking thing in a response is usually the empty template from the
 * prompt, and the answer is the last one.
 *
 * So this returns every plausible candidate, ordered last-first, and lets the
 * caller's schema decide which one is real. Guessing structurally — "take the
 * biggest", "take the last" — would be a coin flip; validating is not.
 */
export function extractJsonCandidates(raw: string): unknown[] {
  const text = raw.trim();
  const seen = new Set<string>();
  const sources: string[] = [];

  const push = (candidate: string) => {
    const trimmed = candidate.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      sources.push(trimmed);
    }
  };

  // Fenced blocks, last first: a model that fences its answer fences it last.
  const fenced: string[] = [];
  const fence = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (let m = fence.exec(text); m; m = fence.exec(text)) {
    if (m[1]) fenced.push(m[1]);
  }
  for (const block of fenced.reverse()) push(block);

  // Balanced objects and arrays, scanning backwards from the end.
  for (const candidate of balancedBlocks(text).reverse()) push(candidate);

  push(text);

  const parsed: unknown[] = [];
  for (const source of sources) {
    try {
      parsed.push(JSON.parse(source));
    } catch {
      /* not this one */
    }
  }
  return parsed;
}

/** The first usable candidate. Throws when the response holds no JSON at all. */
export function extractJson(raw: string): unknown {
  const candidates = extractJsonCandidates(raw);
  if (candidates.length === 0) throw new JsonParseError(raw);
  return candidates[0];
}

export class JsonParseError extends Error {
  constructor(public raw: string) {
    super("The model did not return readable JSON.");
    this.name = "JsonParseError";
  }
}

/** Every balanced {...} or [...] in the text, in the order they start. */
function balancedBlocks(text: string): string[] {
  const blocks: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const open = text[i];
    if (open !== "{" && open !== "[") continue;
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j]!;
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) {
          blocks.push(text.slice(i, j + 1));
          // Skip past this block; nested ones are covered by their parent.
          i = j;
          break;
        }
      }
    }
  }
  return blocks;
}
