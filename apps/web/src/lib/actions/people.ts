"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@warmline/db";
import { requireUser } from "@/lib/session";
import type { ActionResult } from "@/lib/types";

export async function createPerson(formData: FormData): Promise<void> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.person.create({
    data: {
      userId: user.id,
      name,
      relationship: String(formData.get("relationship") ?? "").trim() || null,
      cadenceDays: Number(formData.get("cadenceDays")) || user.defaultCadenceDays,
    },
  });
  revalidatePath("/people");
  revalidatePath("/");
}

export async function updatePerson(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const aliases = String(formData.get("aliases") ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 8);

  await prisma.person.updateMany({
    where: { id, userId: user.id },
    data: {
      name: String(formData.get("name") ?? "").trim() || undefined,
      relationship: String(formData.get("relationship") ?? "").trim() || null,
      cadenceDays: Number(formData.get("cadenceDays")) || undefined,
      aliases,
    },
  });
  revalidatePath(`/people/${id}`);
  revalidatePath("/people");
  revalidatePath("/");
}

/** The honest input for the warmth meter: the user says when they actually spoke. */
export async function markTalked(personId: string, when?: Date): Promise<void> {
  const user = await requireUser();
  await prisma.person.updateMany({
    where: { id: personId, userId: user.id },
    data: { lastContactAt: when ?? new Date() },
  });
  revalidatePath("/people");
  revalidatePath(`/people/${personId}`);
  revalidatePath("/");
}

export async function deletePerson(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const deleted = await prisma.person.deleteMany({ where: { id, userId: user.id } });
  if (deleted.count === 0) return { ok: false, error: "That person is already gone." };
  revalidatePath("/people");
  revalidatePath("/");
  return { ok: true };
}
