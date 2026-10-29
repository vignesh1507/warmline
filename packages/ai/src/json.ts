/**
 * Small models wrap JSON in prose and code fences. This pulls the first complete
 * JSON object or array out of a response without trusting it to be well-behaved.
 */
export function extractJson(raw: string): unknown {
  const text = raw.trim();
  const candidates: string[] = [];

  const fenced = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (let m = fenced.exec(text); m; m = fenced.exec(text)) {
    if (m[1]) candidates.push(m[1].trim());
  }
  const balanced = firstBalanced(text);
  if (balanced) candidates.push(balanced);
  candidates.push(text);

  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      const inner = firstBalanced(c);
      if (inner && inner !== c) {
        try {
          return JSON.parse(inner);
        } catch {
          /* keep looking */
        }
      }
    }
  }
  throw new JsonParseError(raw);
}

export class JsonParseError extends Error {
  constructor(public raw: string) {
    super("The model did not return readable JSON.");
    this.name = "JsonParseError";
  }
}

function firstBalanced(text: string): string | null {
  const start = text.search(/[[{]/);
  if (start === -1) return null;
  const open = text[start]!;
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
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
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
