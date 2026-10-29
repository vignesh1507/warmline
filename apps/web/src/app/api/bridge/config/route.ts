import { prisma, SINGLE_USER_ID } from "@warmline/db";
import { bridgeAuthorized, unauthorized } from "@/lib/bridge-auth";

/**
 * What the bridge is allowed to look at. It polls this, so revoking consent in
 * Settings takes effect without restarting anything.
 */
export async function GET(request: Request) {
  if (!bridgeAuthorized(request)) return unauthorized();

  const [user, chats] = await Promise.all([
    prisma.user.findUnique({ where: { id: SINGLE_USER_ID }, select: { storeSnippets: true } }),
    prisma.whatsappChat.findMany({
      where: { userId: SINGLE_USER_ID, monitored: true },
      select: { chatId: true, name: true },
    }),
  ]);

  return Response.json({
    ok: true,
    monitoredChatIds: chats.map((c) => c.chatId),
    monitoredChats: chats,
    storeSnippets: user?.storeSnippets ?? false,
    // Nothing is read from a chat that is not in the list above.
    pollSeconds: 15,
  });
}
