"use server";

import { revalidatePath } from "next/cache";
import { prisma, type EventKind, type Source } from "@warmline/db";
import { nextOccurrence, parseISODate, reminderDueAt, startOfDay } from "@warmline/shared";
import { requireUser } from "@/lib/session";
import type { ActionResult, ReviewDraft } from "@/lib/types";

const MAX_OFFSET_DAYS = 365;

function cleanOffsets(offsets: number[]): number[] {
  const unique = [...new Set(offsets.map((n) => Math.trunc(n)))]
    .filter((n) => n >= 0 && n <= MAX_OFFSET_DAYS)
    .sort((a, b) => b - a);
  return unique;
}

/** Reminders are materialised, so the timing the user chose is visible and auditable. */
async function syncReminders(eventId: string, date: Date, offsets: number[]) {
  const wanted = cleanOffsets(offsets);
  await prisma.reminder.deleteMany({ where: { eventId, offsetDays: { notIn: wanted } } });
  for (const offsetDays of wanted) {
    const dueAt = reminderDueAt(date, offsetDays);
    await prisma.reminder.upsert({
      where: { eventId_offsetDays: { eventId, offsetDays } },
      update: { dueAt },
      create: { eventId, offsetDays, dueAt },
    });
  }
}

export async function saveReviewedEvent(
  draft: ReviewDraft,
  source: Source = "CHAT",
): Promise<ActionResult<{ eventId: string }>> {
  const user = await requireUser();

  const date = parseISODate(draft.date);
  if (!date) return { ok: false, error: "Pick a date before saving." };
  if (!draft.personName.trim()) return { ok: false, error: "Who is this about?" };
  if (!draft.title.trim()) return { ok: false, error: "Give the event a short title." };

  const personId = await resolvePerson(user.id, draft);
  const eventDate = draft.recurring ? nextOccurrence(date, true) : date;

  const event = await prisma.event.create({
    data: {
      userId: user.id,
      personId,
      title: draft.title.trim(),
      date: eventDate,
      recurring: draft.recurring,
      kind: draft.kind,
      details: draft.details.map((d) => d.trim()).filter(Boolean).slice(0, 12),
      source,
    },
  });

  await syncReminders(event.id, eventDate, draft.reminderOffsets);

  // Durable facts the user kept become notes, which is what later suggestions stand on.
  const notes = draft.notes.map((n) => n.trim()).filter(Boolean).slice(0, 12);
  if (notes.length) {
    await prisma.note.createMany({
      data: notes.map((body) => ({
        userId: user.id,
        personId,
        eventId: event.id,
        body,
        kind: "PREFERENCE" as const,
        source,
      })),
    });
  }

  revalidatePath("/");
  revalidatePath("/people");
  return { ok: true, data: { eventId: event.id } };
}

async function resolvePerson(userId: string, draft: ReviewDraft): Promise<string> {
  if (draft.personId) {
    const existing = await prisma.person.findFirst({ where: { id: draft.personId, userId } });
    if (existing) {
      if (draft.relationship && !existing.relationship) {
        await prisma.person.update({ where: { id: existing.id }, data: { relationship: draft.relationship } });
      }
      return existing.id;
    }
  }
  const name = draft.personName.trim();
  const sameName = await prisma.person.findFirst({
    where: { userId, name: { equals: name, mode: "insensitive" } },
  });
  if (sameName) return sameName.id;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const created = await prisma.person.create({
    data: {
      userId,
      name,
      relationship: draft.relationship?.trim() || null,
      cadenceDays: user.defaultCadenceDays,
    },
  });
  return created.id;
}

export async function updateEvent(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const event = await prisma.event.findFirst({ where: { id, userId: user.id } });
  if (!event) return;

  const date = parseISODate(String(formData.get("date") ?? "")) ?? event.date;
  const recurring = formData.get("recurring") === "on";
  const details = String(formData.get("details") ?? "")
    .split("\n")
    .map((d) => d.trim())
    .filter(Boolean)
    .slice(0, 12);
  const offsets = String(formData.get("offsets") ?? "")
    .split(",")
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isFinite(n));

  const updated = await prisma.event.update({
    where: { id },
    data: {
      title: String(formData.get("title") ?? event.title).trim() || event.title,
      date,
      recurring,
      kind: (String(formData.get("kind") ?? event.kind) as EventKind) ?? event.kind,
      details,
    },
  });

  await syncReminders(updated.id, updated.date, offsets.length ? offsets : user.reminderOffsetsDefault);
  revalidatePath(`/events/${id}`);
  revalidatePath("/");
}

export async function deleteEvent(id: string): Promise<void> {
  const user = await requireUser();
  await prisma.event.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/");
  revalidatePath("/people");
}

export async function dismissReminder(id: string): Promise<void> {
  const user = await requireUser();
  await prisma.reminder.updateMany({
    where: { id, event: { userId: user.id } },
    data: { dismissedAt: new Date(), readAt: new Date() },
  });
  revalidatePath("/");
}

export async function markRemindersRead(eventId: string): Promise<void> {
  const user = await requireUser();
  await prisma.reminder.updateMany({
    where: { eventId, readAt: null, event: { userId: user.id } },
    data: { readAt: new Date() },
  });
}

/**
 * Recurring events roll forward on their own once the follow-up window has
 * passed, so a birthday saved in 2026 still shows up in 2027 without a cron job.
 */
export async function rollRecurringEvents(userId: string): Promise<void> {
  const cutoff = startOfDay(new Date());
  cutoff.setDate(cutoff.getDate() - 3);

  const stale = await prisma.event.findMany({
    where: { userId, recurring: true, date: { lt: cutoff } },
    include: { reminders: { select: { offsetDays: true } } },
  });

  for (const event of stale) {
    const next = nextOccurrence(event.date, true);
    if (next.getTime() === startOfDay(event.date).getTime()) continue;
    await prisma.event.update({
      where: { id: event.id },
      data: { date: next, followedUpAt: null },
    });
    await syncReminders(
      event.id,
      next,
      event.reminders.map((r) => r.offsetDays),
    );
  }
}
