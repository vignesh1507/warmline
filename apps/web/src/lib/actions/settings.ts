"use server";

import { revalidatePath } from "next/cache";
import { prisma, SINGLE_USER_ID } from "@warmline/db";
import { requireUser } from "@/lib/session";

export async function updateSettings(formData: FormData): Promise<void> {
  const user = await requireUser();
  const offsets = String(formData.get("offsets") ?? "")
    .split(",")
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 365);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      reminderOffsetsDefault: offsets.length ? [...new Set(offsets)].sort((a, b) => b - a) : user.reminderOffsetsDefault,
      defaultCadenceDays: Number(formData.get("cadenceDays")) || user.defaultCadenceDays,
      storeSnippets: formData.get("storeSnippets") === "on",
    },
  });
  revalidatePath("/settings");
  revalidatePath("/");
}

/**
 * Per-chat consent. Nothing from a chat is read until this is on, and turning it
 * off takes effect on the bridge's next poll.
 */
export async function setChatMonitored(chatId: string, monitored: boolean): Promise<void> {
  const user = await requireUser();
  await prisma.whatsappChat.updateMany({
    where: { userId: user.id, chatId },
    data: { monitored, consentAt: monitored ? new Date() : null },
  });
  revalidatePath("/settings");
}

export async function forgetWhatsappData(): Promise<void> {
  const user = await requireUser();
  await prisma.$transaction([
    prisma.inboxItem.deleteMany({ where: { userId: user.id } }),
    prisma.whatsappChat.deleteMany({ where: { userId: user.id } }),
    prisma.bridgeState.updateMany({
      where: { id: "singleton" },
      data: { status: "DISCONNECTED", qrDataUrl: null, lastError: null, phoneHint: null },
    }),
  ]);
  revalidatePath("/settings");
  revalidatePath("/inbox");
}

/** The red button: everything about everyone, gone. */
export async function wipeEverything(): Promise<void> {
  await requireUser();
  await prisma.user.delete({ where: { id: SINGLE_USER_ID } }).catch(() => undefined);
  await prisma.bridgeState.deleteMany({});
  await prisma.user.create({ data: { id: SINGLE_USER_ID } });
  revalidatePath("/");
  revalidatePath("/people");
  revalidatePath("/inbox");
  revalidatePath("/settings");
}
