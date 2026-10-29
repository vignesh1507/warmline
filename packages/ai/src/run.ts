import type { ZodType } from "zod";
import { extractJsonCandidates } from "./json";
import { AiError, type GemmaProvider } from "./provider";

export type TaskSpec<T> = {
  name: string;
  system: string;
  user: string;
  schema: ZodType<T>;
  temperature?: number;
  maxTokens?: number;
};

export type TaskResult<T> = { data: T; model: string; attempts: number };

export class AiTaskError extends Error {
  constructor(message: string, public readonly taskName: string, public readonly raw?: string) {
    super(message);
    this.name = "AiTaskError";
  }
}

/**
 * One attempt, then one repair attempt that shows the model its own output and the
 * validation error. If it still doesn't fit the contract we fail loudly — a
 * half-understood event is worse than an honest "I couldn't read that".
 */
export async function runTask<T>(provider: GemmaProvider, spec: TaskSpec<T>): Promise<TaskResult<T>> {
  let lastRaw: string | undefined;
  let lastProblem = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const user =
      attempt === 1
        ? spec.user
        : `${spec.user}\n\n---\nYour previous answer could not be used: ${lastProblem}\nIt was:\n${(lastRaw ?? "").slice(0, 800)}\n\nAnswer again with JSON only, matching the shape exactly.`;

    let raw: string;
    try {
      raw = await provider.complete({
        system: spec.system,
        user,
        temperature: spec.temperature,
        maxTokens: spec.maxTokens,
      });
    } catch (err) {
      // Transport and quota problems are not worth a repair attempt.
      throw new AiTaskError(err instanceof AiError ? err.message : String(err), spec.name);
    }
    lastRaw = raw;

    // A thinking model leaves several JSON-shaped things in its reply, including
    // the empty template it was given. The schema decides which one is the answer.
    const candidates = extractJsonCandidates(raw);
    if (candidates.length === 0) {
      lastProblem = "it contained no JSON";
      continue;
    }

    let problem = "";
    for (const candidate of candidates) {
      // Models also wrap the answer: `[ {...} ]`, or `{"result": {...}}`.
      for (const shape of [candidate, ...unwrapCandidates(candidate)]) {
        const result = spec.schema.safeParse(shape);
        if (result.success) return { data: result.data, model: provider.model, attempts: attempt };
        if (!problem) {
          problem = result.error.issues
            .slice(0, 6)
            .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
            .join("; ");
        }
      }
    }
    lastProblem = problem;
  }

  throw new AiTaskError(
    `Gemma's answer didn't fit the expected shape (${lastProblem}).`,
    spec.name,
    lastRaw,
  );
}

/** Shapes a model wraps its answer in, unwrapped once, cheapest first. */
function unwrapCandidates(parsed: unknown): unknown[] {
  const out: unknown[] = [];
  if (Array.isArray(parsed)) {
    if (parsed.length === 1) out.push(parsed[0]);
    // `[{gifts: [...]}, {checklist: [...]}]` — one object split across entries.
    if (parsed.length > 1 && parsed.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
      out.push(Object.assign({}, ...(parsed as object[])));
    }
    return out;
  }
  if (parsed && typeof parsed === "object") {
    const entries = Object.entries(parsed as Record<string, unknown>);
    // `{"result": {...}}` / `{"response": {...}}`
    if (entries.length === 1 && entries[0]![1] && typeof entries[0]![1] === "object") {
      out.push(entries[0]![1]);
    }
  }
  return out;
}
