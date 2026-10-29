"use server";

import { revalidatePath } from "next/cache";
import { prisma, type NoteKind } from "@warmline/db";
import { requireUser } from "@/lib/session";

export async function addNote(formData: FormData): Promise<void> {
  const user = await requireUser();
  const body = String(formData.get("body") ?? "").trim();
  const personId = String(formData.get("personId") ?? "");
  if (!body || !personId) return;

  const person = await prisma.person.findFirst({ where: { id: personId, userId: user.id } });
  if (!person) return;

  const eventId = String(formData.get("eventId") ?? "") || null;
  const kind = (String(formData.get("kind") ?? "MEMORY") as NoteKind) ?? "MEMORY";

  await prisma.note.create({
    data: { userId: user.id, personId, eventId, body: body.slice(0, 2000), kind },
  });

  // A note written after the event is the app's answer to "how did it go?" —
  // recording it also stops the prompt from nagging.
  if (eventId && kind === "POST_EVENT") {
    await prisma.event.updateMany({
      where: { id: eventId, userId: user.id },
      data: { followedUpAt: new Date() },
    });
    await prisma.event.findFirst({ where: { id: eventId } }).then(async (event) => {
      if (event) await prisma.person.update({ where: { id: event.personId }, data: { lastContactAt: new Date() } });
    });
  }

  if (eventId) revalidatePath(`/events/${eventId}`);
  revalidatePath(`/people/${personId}`);
  revalidatePath("/");
}

export async function updateNote(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  await prisma.note.updateMany({ where: { id, userId: user.id }, data: { body: body.slice(0, 2000) } });
  revalidatePath("/people");
  revalidatePath("/");
}

export async function deleteNote(id: string): Promise<void> {
  const user = await requireUser();
  const note = await prisma.note.findFirst({ where: { id, userId: user.id } });
  if (!note) return;
  await prisma.note.delete({ where: { id } });
  revalidatePath(`/people/${note.personId}`);
  if (note.eventId) revalidatePath(`/events/${note.eventId}`);
  revalidatePath("/");
}

export async function skipFollowUp(eventId: string): Promise<void> {
  const user = await requireUser();
  await prisma.event.updateMany({
    where: { id: eventId, userId: user.id },
    data: { followedUpAt: new Date() },
  });
  revalidatePath("/");
  revalidatePath(`/events/${eventId}`);
}
