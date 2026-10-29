"use server";

import { revalidatePath } from "next/cache";
import { prisma, type EventKind, type LoopDirection } from "@warmline/db";
import { parseISODate } from "@warmline/shared";
import { requireUser } from "@/lib/session";
import type { ActionResult, ReviewDraft } from "@/lib/types";
import { saveReviewedEvent } from "./events";

export type InboxEventPayload = {
  personName: string;
  title: string;
  date: string | null;
  dateText: string | null;
  recurring: boolean;
  kind: EventKind;
  details: string[];
  quote: string;
  confidence: number;
  chatName?: string | null;
};

export type InboxLoopPayload = {
  personName: string;
  text: string;
  direction: LoopDirection;
  dueDate: string | null;
  dueText: string | null;
  quote: string;
  confidence: number;
  chatName?: string | null;
};

/**
 * Accepting is the only path from WhatsApp into the app's real tables. The user
 * can correct anything first — what arrives from a chat is a suggestion, not data.
 */
export async function acceptInboxItem(
  id: string,
  override?: Partial<ReviewDraft> & { text?: string; direction?: LoopDirection; dueAt?: string },
): Promise<ActionResult<{ eventId?: string }>> {
  const user = await requireUser();
  const item = await prisma.inboxItem.findFirst({ where: { id, userId: user.id } });
  if (!item || item.status !== "PENDING") return { ok: false, error: "That item is no longer waiting." };

  if (item.type === "EVENT") {
    const payload = item.payload as unknown as InboxEventPayload;
    const draft: ReviewDraft = {
      personId: override?.personId ?? null,
      personName: override?.personName ?? payload.personName,
      relationship: override?.relationship ?? null,
      title: override?.title ?? payload.title,
      date: override?.date ?? payload.date ?? "",
      recurring: override?.recurring ?? payload.recurring,
      kind: override?.kind ?? payload.kind,
      details: override?.details ?? payload.details,
      notes: override?.notes ?? [],
      reminderOffsets: override?.reminderOffsets ?? user.reminderOffsetsDefault,
    };
    const saved = await saveReviewedEvent(draft, "WHATSAPP");
    if (!saved.ok) return saved;
    await decide(id, "ACCEPTED");
    return { ok: true, data: { eventId: saved.data?.eventId } };
  }

  if (item.type === "OPEN_LOOP") {
    const payload = item.payload as unknown as InboxLoopPayload;
    const personName = (override?.personName ?? payload.personName).trim();
    const personId = await findOrCreatePerson(user.id, personName, user.defaultCadenceDays);
    const dueRaw = override?.dueAt ?? payload.dueDate ?? "";
    await prisma.openLoop.create({
      data: {
        userId: user.id,
        personId,
        text: (override?.text ?? payload.text).slice(0, 400),
        direction: override?.direction ?? payload.direction,
        dueAt: dueRaw ? parseISODate(dueRaw) : null,
        // The quote is only kept if the user turned snippet storage on.
        quote: user.storeSnippets ? (item.snippet ?? payload.quote ?? null) : null,
        sourceMsgHash: item.msgHash,
      },
    });
    await decide(id, "ACCEPTED");
    revalidatePath("/");
    return { ok: true };
  }

  // CONTACT_PING: no content, only "you two spoke" — it just warms the line.
  const payload = item.payload as unknown as { personName: string; at?: string };
  const personId = await findOrCreatePerson(user.id, payload.personName, user.defaultCadenceDays);
  await prisma.person.update({
    where: { id: personId },
    data: { lastContactAt: payload.at ? new Date(payload.at) : new Date() },
  });
  await decide(id, "ACCEPTED");
  revalidatePath("/");
  return { ok: true };
}

export async function rejectInboxItem(id: string): Promise<void> {
  const user = await requireUser();
  await prisma.inboxItem.updateMany({
    where: { id, userId: user.id, status: "PENDING" },
    data: { status: "REJECTED", decidedAt: new Date() },
  });
  revalidatePath("/inbox");
  revalidatePath("/");
}

export async function clearDecidedInbox(): Promise<void> {
  const user = await requireUser();
  await prisma.inboxItem.deleteMany({ where: { userId: user.id, status: { in: ["ACCEPTED", "REJECTED"] } } });
  revalidatePath("/inbox");
}

async function decide(id: string, status: "ACCEPTED" | "REJECTED") {
  await prisma.inboxItem.update({ where: { id }, data: { status, decidedAt: new Date() } });
  revalidatePath("/inbox");
  revalidatePath("/");
}

async function findOrCreatePerson(userId: string, name: string, cadenceDays: number): Promise<string> {
  const existing = await prisma.person.findFirst({
    where: { userId, name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return existing.id;
  const created = await prisma.person.create({ data: { userId, name, cadenceDays } });
  return created.id;
}
