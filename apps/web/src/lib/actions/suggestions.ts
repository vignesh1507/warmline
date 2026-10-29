"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Prisma, type SuggestionKind } from "@warmline/db";
import {
  AiTaskError,
  echo as echoTask,
  groundItems,
  minimizeNotes,
  rehearse as rehearseTask,
  suggestPrep,
  type Idea,
} from "@warmline/ai";
import { daysSince, daysUntil, toISODate } from "@warmline/shared";
import { requireUser } from "@/lib/session";
import { AI_UNAVAILABLE_MESSAGE, aiReady, gemma } from "@/lib/ai";
import type { ActionResult } from "@/lib/types";

const PREP_KINDS: SuggestionKind[] = ["GIFT", "CHECKLIST", "TOPIC", "DRAFT", "QUESTION"];

/** How far back a note has to be to count as an "echo" rather than current context. */
const ECHO_MIN_AGE_DAYS = 60;

async function loadEvent(userId: string, eventId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, userId },
    include: {
      person: { include: { notes: { orderBy: { createdAt: "desc" } } } },
    },
  });
}

/**
 * Generates the prep ideas for an event.
 *
 * Two things make this trustworthy rather than plausible: the model only ever
 * sees notes the user wrote (minimised and redacted first), and every idea it
 * returns is checked against those note ids before it is stored. An idea citing
 * a note that does not exist is a fabricated memory, and is dropped here.
 */
export async function generatePrep(eventId: string): Promise<ActionResult<{ kept: number; dropped: number }>> {
  const user = await requireUser();
  if (!aiReady()) return { ok: false, error: AI_UNAVAILABLE_MESSAGE };

  const event = await loadEvent(user.id, eventId);
  if (!event) return { ok: false, error: "That event is gone." };

  const notes = minimizeNotes(event.person.notes);
  const validIds = new Set(event.person.notes.map((n) => n.id));

  try {
    const { data, model } = await suggestPrep(gemma(), {
      person: { name: event.person.name, relationship: event.person.relationship },
      event: {
        title: event.title,
        date: toISODate(event.date),
        kind: event.kind,
        details: event.details,
        recurring: event.recurring,
      },
      notes,
      daysAway: daysUntil(event.date),
    });

    const rows: Prisma.SuggestionCreateManyInput[] = [];
    let dropped = 0;

    for (const [kind, items] of [
      ["GIFT", data.gifts],
      ["CHECKLIST", data.checklist],
      ["TOPIC", data.topics],
    ] as const) {
      const report = groundItems(items, validIds);
      dropped += report.dropped.length;
      for (const item of report.kept.slice(0, 5)) {
        rows.push(suggestionRow(event.id, kind, item, model));
      }
    }

    if (data.draft) {
      const report = groundItems([{ ...data.draft, assumption: data.draft.assumption ?? "a starting point to edit" }], validIds);
      dropped += report.dropped.length;
      const draft = report.kept[0];
      if (draft) rows.push(suggestionRow(event.id, "DRAFT", draft, model));
    }

    for (const question of data.questions.slice(0, 4)) {
      rows.push({
        eventId: event.id,
        kind: "QUESTION",
        content: { text: question },
        groundedNoteIds: [],
        assumptions: [],
        model,
      });
    }

    if (rows.length === 0) {
      return {
        ok: false,
        error:
          dropped > 0
            ? `Gemma's ${dropped} idea${dropped === 1 ? "" : "s"} all cited notes that don't exist, so none are shown. Try again.`
            : "Gemma didn't return anything usable this time. Try again.",
      };
    }

    // Replace only the untouched ones: anything the user kept or dismissed stays.
    await prisma.suggestion.deleteMany({
      where: { eventId: event.id, kind: { in: PREP_KINDS }, status: "NEW" },
    });
    await prisma.suggestion.createMany({ data: rows });

    revalidatePath(`/events/${eventId}`);
    return { ok: true, data: { kept: rows.length, dropped } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

function suggestionRow(
  eventId: string,
  kind: SuggestionKind,
  item: Idea,
  model: string,
): Prisma.SuggestionCreateManyInput {
  return {
    eventId,
    kind,
    content: { text: item.text },
    groundedNoteIds: item.groundedOn ?? [],
    assumptions: item.assumption ? [item.assumption] : [],
    model,
  };
}

/**
 * The echo: one real note from the past, resurfaced because it matters now.
 * The model picks which note; it does not get to write the memory. If the id it
 * returns is not one of the notes we sent, there is no echo.
 */
export async function generateEcho(eventId: string): Promise<ActionResult<{ found: boolean }>> {
  const user = await requireUser();
  if (!aiReady()) return { ok: false, error: AI_UNAVAILABLE_MESSAGE };

  const event = await loadEvent(user.id, eventId);
  if (!event) return { ok: false, error: "That event is gone." };

  const older = event.person.notes.filter((n) => (daysSince(n.createdAt) ?? 0) >= ECHO_MIN_AGE_DAYS);
  if (older.length === 0) {
    return { ok: false, error: "No older notes yet — echoes need something to look back on." };
  }

  try {
    const { data, model } = await echoTask(gemma(), {
      person: { name: event.person.name },
      event: { title: event.title, date: toISODate(event.date), kind: event.kind },
      notes: minimizeNotes(older, { max: 12 }),
    });

    await prisma.suggestion.deleteMany({ where: { eventId: event.id, kind: "ECHO", status: "NEW" } });

    const noteExists = data.noteId ? older.some((n) => n.id === data.noteId) : false;
    if (!data.line || !noteExists) {
      // Nothing genuinely relevant, or a note id we never sent. Say nothing.
      revalidatePath(`/events/${eventId}`);
      return { ok: true, data: { found: false } };
    }

    await prisma.suggestion.create({
      data: {
        eventId: event.id,
        kind: "ECHO",
        content: { text: data.line, noteId: data.noteId },
        groundedNoteIds: [data.noteId!],
        model,
      },
    });
    revalidatePath(`/events/${eventId}`);
    return { ok: true, data: { found: true } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** The rehearsal, for conversations that are hard to start. */
export async function generateRehearsal(eventId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!aiReady()) return { ok: false, error: AI_UNAVAILABLE_MESSAGE };

  const event = await loadEvent(user.id, eventId);
  if (!event) return { ok: false, error: "That event is gone." };

  try {
    const { data, model } = await rehearseTask(gemma(), {
      person: { name: event.person.name, relationship: event.person.relationship },
      event: { title: event.title, kind: event.kind, details: event.details },
      notes: minimizeNotes(event.person.notes, { max: 12 }),
      daysSinceContact: daysSince(event.person.lastContactAt),
    });

    const validIds = new Set(event.person.notes.map((n) => n.id));
    const openers = groundItems(
      data.openers.map((o) => ({ ...o, assumption: o.assumption ?? "a suggested opener" })),
      validIds,
    ).kept;

    await prisma.suggestion.deleteMany({ where: { eventId: event.id, kind: "REHEARSAL", status: "NEW" } });
    await prisma.suggestion.create({
      data: {
        eventId: event.id,
        kind: "REHEARSAL",
        content: {
          feelings: data.feelings.slice(0, 4),
          openers: openers.slice(0, 2).map((o) => ({ text: o.text, groundedOn: o.groundedOn ?? [] })),
          avoid: data.avoid.slice(0, 3),
          reminder: data.reminder,
        },
        groundedNoteIds: openers.flatMap((o) => o.groundedOn ?? []),
        model,
      },
    });
    revalidatePath(`/events/${eventId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function dismissSuggestion(id: string): Promise<void> {
  const user = await requireUser();
  const suggestion = await prisma.suggestion.findFirst({
    where: { id, event: { userId: user.id } },
    select: { eventId: true },
  });
  if (!suggestion) return;
  await prisma.suggestion.update({ where: { id }, data: { status: "DISMISSED" } });
  revalidatePath(`/events/${suggestion.eventId}`);
}

/** Keeping an idea copies it into the notes, where it can ground future suggestions. */
export async function keepSuggestion(id: string): Promise<void> {
  const user = await requireUser();
  const suggestion = await prisma.suggestion.findFirst({
    where: { id, event: { userId: user.id } },
    include: { event: true },
  });
  if (!suggestion) return;

  const content = suggestion.content as { text?: string };
  await prisma.suggestion.update({ where: { id }, data: { status: "KEPT" } });

  if (content.text && suggestion.kind !== "QUESTION") {
    await prisma.note.create({
      data: {
        userId: user.id,
        personId: suggestion.event.personId,
        eventId: suggestion.eventId,
        body: content.text,
        kind: "IDEA",
      },
    });
  }
  revalidatePath(`/events/${suggestion.eventId}`);
}

function errorMessage(err: unknown): string {
  if (err instanceof AiTaskError) return err.message;
  return err instanceof Error ? err.message : "Gemma could not be reached.";
}
