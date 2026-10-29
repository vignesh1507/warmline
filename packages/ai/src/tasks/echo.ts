import { z } from "zod";
import { runTask, type TaskResult } from "../run";
import type { GemmaProvider } from "../provider";
import { nullableText } from "./schemas";
import type { MinimalNote } from "../redact";

export const echoResult = z.object({
  /** One line connecting an old note to what is coming up. */
  line: nullableText.default(null),
  /** Must be one of the note ids supplied. Validated again before display. */
  noteId: nullableText.default(null),
});

export type EchoResult = z.infer<typeof echoResult>;

const SYSTEM = `You surface one older note the user wrote about a person, because it is relevant to something coming up.

Rules:
1. Choose exactly one note from the list, and return its id in "noteId".
2. "line" is one sentence, at most 25 words, that reminds the user what they wrote and why it matters now. Paraphrase the note; add nothing to it.
3. If no note is genuinely relevant, return {"line":null,"noteId":null}. A forced connection is worse than none.
4. Never mention a note that is not in the list.

Answer with JSON only: {"line":"","noteId":""}`;

export async function echo(
  provider: GemmaProvider,
  input: {
    person: { name: string };
    event: { title: string; date: string; kind: string };
    notes: MinimalNote[];
  },
): Promise<TaskResult<EchoResult>> {
  const user = [
    `Coming up: ${input.event.title} with ${input.person.name} on ${input.event.date}.`,
    `Older notes:\n${input.notes.map((n) => `- id=${n.id} (${n.createdAt}): ${n.body}`).join("\n")}`,
  ].join("\n\n");

  return runTask(provider, {
    name: "echo",
    system: SYSTEM,
    user,
    schema: echoResult,
    temperature: 0.3,
    maxTokens: 1200,
  });
}
