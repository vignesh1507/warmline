import { prisma, SINGLE_USER_ID } from "@warmline/db";
import { revalidatePath } from "next/cache";
import { bridgeAuthorized, unauthorized } from "@/lib/bridge-auth";

/**
 * The chat list, so the user can choose what to monitor. Names and ids only —
 * no message content — and an existing chat's `monitored` flag is never
 * overwritten by this.
 */
export async function POST(request: Request) {
  if (!bridgeAuthorized(request)) return unauthorized();

  const body = (await request.json().catch(() => ({}))) as {
    chats?: { chatId: string; name: string; isGroup?: boolean; lastMessageAt?: string | null }[];
  };
  const chats = (body.chats ?? []).slice(0, 300);

  for (const chat of chats) {
    if (!chat.chatId || !chat.name) continue;
    const lastMessageAt = chat.lastMessageAt ? new Date(chat.lastMessageAt) : null;
    await prisma.whatsappChat.upsert({
      where: { userId_chatId: { userId: SINGLE_USER_ID, chatId: chat.chatId } },
      update: { name: chat.name.slice(0, 120), isGroup: Boolean(chat.isGroup), lastMessageAt },
      create: {
        userId: SINGLE_USER_ID,
        chatId: chat.chatId,
        name: chat.name.slice(0, 120),
        isGroup: Boolean(chat.isGroup),
        lastMessageAt,
        monitored: false,
      },
    });
  }

  revalidatePath("/settings");
  return Response.json({ ok: true, received: chats.length });
}
