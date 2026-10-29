import type { ZodType } from "zod";
import { extractJson, JsonParseError } from "./json";
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

    let parsed: unknown;
    try {
      parsed = extractJson(raw);
    } catch (err) {
      lastProblem = err instanceof JsonParseError ? "it was not valid JSON" : String(err);
      continue;
    }

    const result = spec.schema.safeParse(parsed);
    if (result.success) return { data: result.data, model: provider.model, attempts: attempt };
    lastProblem = result.error.issues
      .slice(0, 6)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
  }

  throw new AiTaskError(
    `Gemma's answer didn't fit the expected shape (${lastProblem}).`,
    spec.name,
    lastRaw,
  );
}
