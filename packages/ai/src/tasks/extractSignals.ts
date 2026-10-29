import { z } from "zod";
import { runTask, type TaskResult } from "../run";
import type { GemmaProvider } from "../provider";
import { boolish, confidence, eventKind, nullableDate, nullableText, strArray } from "./schemas";

/**
 * Reads a short window of messages from chats the user chose to monitor and
 * proposes two kinds of thing: dated plans, and promises either side made.
 * Nothing here is saved automatically — every item becomes an inbox proposal.
 */

export const signalEvent = z.object({
  personName: z.string().min(1),
  title: z.string().min(1),
  date: nullableDate,
  dateText: nullableText.default(null),
  recurring: boolish.default(false),
  kind: eventKind,
  details: strArray.default([]),
  quote: z.string().min(1),
  messageId: nullableText.default(null),
  confidence,
});

export const signalLoop = z.object({
  personName: z.string().min(1),
  text: z.string().min(1),
  /** I_OWE when the user promised; THEY_OWE when the other person did. */
  direction: z.preprocess(
    (v) => (typeof v === "string" ? v.toUpperCase().replace(/[^A-Z_]/g, "") : v),
    z.enum(["I_OWE", "THEY_OWE"]).catch("I_OWE"),
  ),
  dueDate: nullableDate,
  dueText: nullableText.default(null),
  quote: z.string().min(1),
  messageId: nullableText.default(null),
  confidence,
});

export const extractedSignals = z.object({
  events: z.array(signalEvent).default([]),
  loops: z.array(signalLoop).default([]),
});

export type SignalEvent = z.infer<typeof signalEvent>;
export type SignalLoop = z.infer<typeof signalLoop>;
export type ExtractedSignals = z.infer<typeof extractedSignals>;

const SYSTEM = `You read a few recent messages from one chat and pick out two things only:

A) events — something happening on a day: a birthday, a dinner, a trip, a visit, an appointment the user is part of.
B) loops — a promise or commitment someone made in passing, which is easy to forget. "I'll send you the recipe" is a loop the sender owes. "Can you book it?" answered with "yes" is a loop too.

Rules, in order of importance:
1. Quote the message the item came from, verbatim, in "quote". If you cannot quote it, do not propose it.
2. Never invent a date. Relative timing you cannot resolve goes in "dateText"/"dueText" with the date left null.
3. "direction" is I_OWE when the user (marked ME) made the promise, THEY_OWE when the other person did.
4. Small talk, jokes, reactions, links and logistics already settled are not signals. Returning nothing is the normal, correct answer.
5. Use the name given for the chat as "personName" unless a message clearly names someone else as the subject.
6. Do not repeat the same thing as both an event and a loop. Prefer the event if it has a date.
7. "confidence" is 0 to 1.

Answer with one JSON object, never a list, and no text around it. This exact shape:
{"events":[{"personName":"","title":"","date":null,"dateText":null,"recurring":false,"kind":"OTHER","details":[],"quote":"","messageId":"","confidence":0.0}],"loops":[{"personName":"","text":"","direction":"I_OWE","dueDate":null,"dueText":null,"quote":"","messageId":"","confidence":0.0}]}`;

export type BridgeMessage = { id: string; isMe: boolean; text: string; at: Date };

export async function extractSignals(
  provider: GemmaProvider,
  input: { chatName: string; messages: BridgeMessage[]; today: Date },
): Promise<TaskResult<ExtractedSignals>> {
  const transcript = input.messages
    .map((m) => `[${m.id}] ${m.isMe ? "ME" : input.chatName} (${m.at.toLocaleDateString("en-CA")}): ${m.text}`)
    .join("\n");

  const user = [
    `Today is ${input.today.toLocaleDateString("en-CA")}.`,
    `Chat with: ${input.chatName}`,
    `Messages:\n${transcript}`,
  ].join("\n\n");

  return runTask(provider, {
    name: "extractSignals",
    system: SYSTEM,
    user,
    schema: extractedSignals,
    temperature: 0.2,
    maxTokens: 3500,
  });
}

/** Signals below this are not worth bothering the user with. */
export const SIGNAL_MIN_CONFIDENCE = 0.5;

export function worthProposing(s: { confidence: number; quote: string }): boolean {
  return s.confidence >= SIGNAL_MIN_CONFIDENCE && s.quote.trim().length > 0;
}
