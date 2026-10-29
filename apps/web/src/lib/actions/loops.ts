"use server";

import { revalidatePath } from "next/cache";
import { prisma, type LoopDirection, type LoopStatus } from "@warmline/db";
import { parseISODate } from "@warmline/shared";
import { requireUser } from "@/lib/session";

export async function addLoop(formData: FormData): Promise<void> {
  const user = await requireUser();
  const personId = String(formData.get("personId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!personId || !text) return;

  const person = await prisma.person.findFirst({ where: { id: personId, userId: user.id } });
  if (!person) return;

  const dueRaw = String(formData.get("dueAt") ?? "").trim();
  await prisma.openLoop.create({
    data: {
      userId: user.id,
      personId,
      text: text.slice(0, 400),
      direction: (String(formData.get("direction") ?? "I_OWE") as LoopDirection) ?? "I_OWE",
      dueAt: dueRaw ? parseISODate(dueRaw) : null,
    },
  });
  revalidatePath("/");
  revalidatePath(`/people/${personId}`);
}

export async function closeLoop(id: string, status: LoopStatus = "DONE"): Promise<void> {
  const user = await requireUser();
  const loop = await prisma.openLoop.findFirst({ where: { id, userId: user.id } });
  if (!loop) return;
  await prisma.openLoop.update({
    where: { id },
    data: { status, closedAt: new Date() },
  });
  // Doing the thing you promised is contact; reopening a cold line counts.
  if (status === "DONE") {
    await prisma.person.update({ where: { id: loop.personId }, data: { lastContactAt: new Date() } });
  }
  revalidatePath("/");
  revalidatePath(`/people/${loop.personId}`);
}

export async function reopenLoop(id: string): Promise<void> {
  const user = await requireUser();
  await prisma.openLoop.updateMany({
    where: { id, userId: user.id },
    data: { status: "OPEN", closedAt: null },
  });
  revalidatePath("/");
}

export async function deleteLoop(id: string): Promise<void> {
  const user = await requireUser();
  await prisma.openLoop.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/");
}
