import { prisma } from "@warmline/db";
import { requireUser } from "@/lib/session";

/**
 * Everything the app holds about you, in one file. Requirement 6: you can see
 * and take your data, not just delete it.
 */
export async function GET() {
  const user = await requireUser();

  const [people, events, notes, openLoops, inboxItems, chats, suggestions] = await Promise.all([
    prisma.person.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
    prisma.event.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
      include: { reminders: true },
    }),
    prisma.note.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.openLoop.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.inboxItem.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.whatsappChat.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
    prisma.suggestion.findMany({
      where: { event: { userId: user.id } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    app: "Warmline",
    note:
      "This is everything Warmline stores about you and the people you added. Suggestions include the note ids they were grounded in.",
    settings: {
      reminderOffsetsDefault: user.reminderOffsetsDefault,
      defaultCadenceDays: user.defaultCadenceDays,
      aiProvider: user.aiProvider,
      storeSnippets: user.storeSnippets,
    },
    people,
    events,
    notes,
    openLoops,
    suggestions,
    whatsappChats: chats,
    inboxItems,
  };

  const filename = `warmline-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
