import { z } from "zod";
import { runTask, type TaskResult } from "../run";
import type { GemmaProvider } from "../provider";
import { ideaArray, strArray } from "./schemas";
import type { MinimalNote } from "../redact";

export const rehearsal = z.object({
  /** Hedged, never asserted: "they may be...". */
  feelings: strArray.default([]),
  openers: ideaArray.default([]),
  avoid: strArray.default([]),
  reminder: z.string().default("These are guesses about a person only you know."),
});

export type Rehearsal = z.infer<typeof rehearsal>;

const SYSTEM = `You help someone rehearse a conversation that is hard to start: an apology, a condolence, asking a favour, or reconnecting after a long silence.

Rules, in order of importance:
1. You do not know this person. Anything about their state of mind is a possibility, phrased as "they may" or "they might" — never as fact.
2. Use the user's own notes where they help, and never contradict them.
3. Give exactly two openers, each one or two sentences, in a plain spoken voice the user could actually say.
4. "avoid" is at most two things not to say, and why in a few words.
5. No therapy-speak, no scripts that manipulate, no diagnosis, and no medical, legal or clinical advice. If the situation sounds like a crisis, say plainly in "reminder" that a short, human, non-advising message is usually better than a prepared one.
6. Keep it short. This is a nudge before a conversation, not a manual.

Answer with one JSON object, never a list, and no text around it. This exact shape:
{"feelings":[""],"openers":[{"text":"","groundedOn":[],"assumption":null}],"avoid":[""],"reminder":""}`;

export async function rehearse(
  provider: GemmaProvider,
  input: {
    person: { name: string; relationship?: string | null };
    event: { title: string; kind: string; details: string[] };
    notes: MinimalNote[];
    daysSinceContact: number | null;
  },
): Promise<TaskResult<Rehearsal>> {
  const user = [
    `Person: ${input.person.name}${input.person.relationship ? ` (${input.person.relationship})` : ""}`,
    `Situation: ${input.event.title} (${input.event.kind})`,
    input.event.details.length ? `Details: ${input.event.details.join("; ")}` : null,
    input.daysSinceContact === null
      ? "No contact recorded yet."
      : `Last contact about ${input.daysSinceContact} days ago.`,
    input.notes.length
      ? `Notes the user wrote:\n${input.notes.map((n) => `- id=${n.id}: ${n.body}`).join("\n")}`
      : "(no notes saved for this person yet)",
  ]
    .filter(Boolean)
    .join("\n\n");

  return runTask(provider, {
    name: "rehearse",
    system: SYSTEM,
    user,
    schema: rehearsal,
    temperature: 0.5,
    maxTokens: 2500,
  });
}
