"use server";

import { extractEvent, AiTaskError } from "@warmline/ai";
import { prisma } from "@warmline/db";
import { toISODate, nextOccurrence, parseISODate } from "@warmline/shared";
import { requireUser } from "@/lib/session";
import { AI_UNAVAILABLE_MESSAGE, aiReady, gemma } from "@/lib/ai";
import type { ProposeResult, ReviewDraft } from "@/lib/types";

/**
 * Turns a sentence into a *proposal*. Nothing is saved here — the user sees every
 * field and corrects it first, which is the whole point of the review step.
 */
export async function proposeEvent(message: string): Promise<ProposeResult> {
  const user = await requireUser();
  const text = message.trim();
  if (text.length < 3) return { ok: false, error: "Tell me a little more than that." };
  if (!aiReady()) return { ok: false, error: AI_UNAVAILABLE_MESSAGE };

  const people = await prisma.person.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, aliases: true, relationship: true },
    orderBy: { name: "asc" },
  });

  try {
    const { data, model } = await extractEvent(gemma(), {
      message: text,
      today: new Date(),
      knownPeople: people.map((p) => p.name),
    });

    const match = matchPerson(people, data.person.name);
    const date = data.date ? parseISODate(data.date) : null;

    const draft: ReviewDraft = {
      personId: match?.id ?? null,
      personName: match?.name ?? data.person.name.trim(),
      relationship: match?.relationship ?? data.person.relationship,
      title: data.title.trim(),
      date: date ? toISODate(data.recurring ? nextOccurrence(date, true) : date) : "",
      recurring: data.recurring,
      kind: data.kind,
      details: data.details,
      notes: data.noteWorthy,
      reminderOffsets: user.reminderOffsetsDefault,
    };

    return {
      ok: true,
      draft,
      followUpQuestion: data.followUpQuestion,
      confidence: data.confidence,
      dateText: data.dateText,
      model,
      matchedExistingPerson: Boolean(match),
    };
  } catch (err) {
    if (err instanceof AiTaskError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong reading that." };
  }
}

type Candidate = { id: string; name: string; aliases: string[]; relationship: string | null };

/** Exact or alias match only — a fuzzy guess here would quietly merge two people. */
function matchPerson(people: Candidate[], name: string): Candidate | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  return (
    people.find((p) => p.name.toLowerCase() === needle) ??
    people.find((p) => p.aliases.some((a) => a.toLowerCase() === needle)) ??
    null
  );
}
