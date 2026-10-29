import { z } from "zod";
import { runTask, type TaskResult } from "../run";
import type { GemmaProvider } from "../provider";
import { idea, ideaArray, strArray } from "./schemas";
import type { MinimalNote } from "../redact";

export const prepSuggestions = z.object({
  gifts: ideaArray.default([]),
  checklist: ideaArray.default([]),
  topics: ideaArray.default([]),
  draft: idea.nullable().default(null),
  /** What the app should ask the user, when the notes are too thin to be useful. */
  questions: strArray.default([]),
});

export type PrepSuggestions = z.infer<typeof prepSuggestions>;

const SYSTEM = `You help someone prepare for an event with a friend or family member, in a personal app.

You are given notes the user wrote themselves. These notes are the only thing you know about this person.

Rules, in order of importance:
1. Never state a preference, fact or memory that is not in the notes. You do not know this person.
2. Every idea must either cite the notes it came from in "groundedOn" (using the exact note ids given), or state plainly in "assumption" that it is a general guess. An idea with neither is not allowed.
3. Never cite a note id that was not given to you.
4. If the notes say little, say so: put specific, useful things to ask the user in "questions", and keep ideas few and clearly marked as guesses.
5. Ideas are short and practical. No flattery, no padding, no emoji.
6. "draft" is a message the user could send, in their own plain voice, 2 to 4 sentences, no placeholders like [name] unless the information is genuinely missing.
7. Suggest nothing that spends large sums, promises on the user's behalf, or assumes the user's budget.

Answer with one JSON object, never a list, and no text around it. This exact shape:
{"gifts":[{"text":"","groundedOn":["noteId"],"assumption":null}],"checklist":[{"text":"","groundedOn":[],"assumption":"general suggestion"}],"topics":[{"text":"","groundedOn":[],"assumption":null}],"draft":{"text":"","groundedOn":[]},"questions":[]}`;

export async function suggestPrep(
  provider: GemmaProvider,
  input: {
    person: { name: string; relationship?: string | null };
    event: { title: string; date: string; kind: string; details: string[]; recurring: boolean };
    notes: MinimalNote[];
    daysAway: number;
  },
): Promise<TaskResult<PrepSuggestions>> {
  const notesBlock = input.notes.length
    ? input.notes.map((n) => `- id=${n.id} (${n.kind}, ${n.createdAt}): ${n.body}`).join("\n")
    : "(no notes saved for this person yet)";

  const user = [
    `Person: ${input.person.name}${input.person.relationship ? ` (${input.person.relationship})` : ""}`,
    `Event: ${input.event.title} — ${input.event.date}, ${input.daysAway} days away, kind ${input.event.kind}${input.event.recurring ? ", happens yearly" : ""}`,
    input.event.details.length ? `Details the user gave: ${input.event.details.join("; ")}` : null,
    `Notes the user wrote:\n${notesBlock}`,
    `Give at most 4 gift or activity ideas, 4 checklist items, 4 conversation topics, and one message draft.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return runTask(provider, {
    name: "suggestPrep",
    system: SYSTEM,
    user,
    schema: prepSuggestions,
    temperature: 0.6,
    maxTokens: 4000,
  });
}
