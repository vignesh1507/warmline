import { z } from "zod";
import { runTask, type TaskResult } from "../run";
import type { GemmaProvider } from "../provider";
import { boolish, confidence, eventKind, nullableDate, nullableText, strArray } from "./schemas";

export const extractedEvent = z.object({
  person: z.object({
    name: z.string().min(1),
    relationship: nullableText.default(null),
  }),
  title: z.string().min(1),
  date: nullableDate,
  /** What the user actually said about timing, kept so we can quote it back. */
  dateText: nullableText.default(null),
  recurring: boolish.default(false),
  kind: eventKind,
  /** One-off specifics: "dinner at 8", "she's bringing her partner". */
  details: strArray.default([]),
  /** Durable facts about the person, saved as notes if the user keeps them. */
  noteWorthy: strArray.default([]),
  confidence,
  missing: strArray.default([]),
  followUpQuestion: nullableText.default(null),
});

export type ExtractedEvent = z.infer<typeof extractedEvent>;

const SYSTEM = `You turn a short message into a proposed calendar-style record for a personal friendship app.

Rules, in order of importance:
1. Only record what the message says. Never invent a date, a surname, a preference or a relationship.
2. If the date is absent, relative in a way you cannot resolve, or ambiguous, set "date" to null, list "date" in "missing", and write one short "followUpQuestion" asking for it.
3. Resolve clear relative dates against the supplied today's date ("tomorrow", "next Friday", "in two weeks"). A month and day with no year means the next time that date occurs.
4. "recurring" is true only for things that repeat every year, such as a birthday or an anniversary.
5. Put one-off arrangements in "details". Put lasting facts about the person (likes, dislikes, situation) in "noteWorthy".
6. "kind" is one of CELEBRATION, MILESTONE, CATCHUP, APOLOGY, CONDOLENCE, FAVOUR, OTHER.
7. "confidence" is 0 to 1: how sure you are the whole record is right.

Answer with JSON only, no prose, in this shape:
{"person":{"name":"","relationship":null},"title":"","date":"YYYY-MM-DD or null","dateText":null,"recurring":false,"kind":"OTHER","details":[],"noteWorthy":[],"confidence":0.0,"missing":[],"followUpQuestion":null}`;

export async function extractEvent(
  provider: GemmaProvider,
  input: { message: string; today: Date; knownPeople?: string[] },
): Promise<TaskResult<ExtractedEvent>> {
  const today = input.today;
  const known = (input.knownPeople ?? []).slice(0, 40);
  const user = [
    `Today is ${today.toLocaleDateString("en-CA")} (${today.toLocaleDateString(undefined, { weekday: "long" })}).`,
    known.length ? `People already saved: ${known.join(", ")}. Reuse a name exactly if it clearly matches.` : null,
    `Message:\n"""${input.message.trim()}"""`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await runTask(provider, {
    name: "extractEvent",
    system: SYSTEM,
    user,
    schema: extractedEvent,
    temperature: 0.1,
    maxTokens: 700,
  });

  return { ...result, data: tidy(result.data) };
}

/**
 * Belt and braces: the app must never save an event with no date, and must never
 * leave the user without a question when something is missing.
 */
function tidy(e: ExtractedEvent): ExtractedEvent {
  const missing = new Set(e.missing.map((m) => m.toLowerCase()));
  if (!e.date) missing.add("date");
  if (!e.person.name.trim()) missing.add("person");

  let followUpQuestion = e.followUpQuestion;
  if (missing.size > 0 && !followUpQuestion) {
    followUpQuestion = missing.has("date")
      ? "Which date should I put this on?"
      : `Could you tell me the ${[...missing][0]}?`;
  }
  if (missing.size === 0) followUpQuestion = null;

  return { ...e, missing: [...missing], followUpQuestion };
}

export function needsFollowUp(e: ExtractedEvent, minConfidence = 0.45): boolean {
  return !e.date || !e.person.name.trim() || e.confidence < minConfidence;
}
