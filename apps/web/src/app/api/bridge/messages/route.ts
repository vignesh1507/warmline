import { revalidatePath } from "next/cache";
import { extractSignals, worthProposing, redact } from "@warmline/ai";
import { prisma, SINGLE_USER_ID, type Prisma } from "@warmline/db";
import { stableHash, truncate } from "@warmline/shared";
import { bridgeAuthorized, unauthorized } from "@/lib/bridge-auth";
import { aiReady, gemma } from "@/lib/ai";
import { acceptInboxItem } from "@/lib/actions/inbox";

const MAX_MESSAGES = 40;
const MAX_TEXT = 2000;
const SNIPPET_CHARS = 180;

/**
 * Where WhatsApp content enters, and stops.
 *
 * The bridge posts a window of messages from a chat the user has explicitly
 * chosen to monitor. This endpoint reads them, proposes events and open loops,
 * and keeps only those proposals. The messages themselves are never written to
 * the database — at most a short quote, and only if the user asked for quotes.
 */
export async function POST(request: Request) {
  if (!bridgeAuthorized(request)) return unauthorized();

  const body = (await request.json().catch(() => ({}))) as {
    chatId?: string;
    chatName?: string;
    isGroup?: boolean;
    messages?: { id: string; isMe?: boolean; text: string; at?: string }[];
  };

  if (!body.chatId || !body.messages?.length) {
    return Response.json({ ok: false, error: "chatId and messages are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: SINGLE_USER_ID } });
  if (!user) return Response.json({ ok: false, error: "no user" }, { status: 400 });

  // Consent check, server side. With "watch every chat" on, a chat the bridge
  // has not seen before is registered and watched straight away; otherwise an
  // unticked chat is ignored even if the bridge sends it.
  let chat = await prisma.whatsappChat.findUnique({
    where: { userId_chatId: { userId: SINGLE_USER_ID, chatId: body.chatId } },
  });

  if (user.monitorAllChats) {
    chat = await prisma.whatsappChat.upsert({
      where: { userId_chatId: { userId: SINGLE_USER_ID, chatId: body.chatId } },
      update: { monitored: true, consentAt: chat?.consentAt ?? new Date() },
      create: {
        userId: SINGLE_USER_ID,
        chatId: body.chatId,
        name: (body.chatName ?? body.chatId).slice(0, 120),
        isGroup: Boolean(body.isGroup),
        monitored: true,
        consentAt: new Date(),
      },
    });
  }

  if (!chat || !chat.monitored) {
    console.log(`[bridge] ${body.chatId}: not watched, ${body.messages.length} message(s) ignored`);
    return Response.json({ ok: true, skipped: "not monitored", created: 0 });
  }

  const lastMessageAt = body.messages.reduce<Date | null>((latest, m) => {
    const at = m.at ? new Date(m.at) : null;
    return at && (!latest || at > latest) ? at : latest;
  }, null);

  // Chat activity is a warmth signal on its own: a timestamp, no content.
  await prisma.whatsappChat.update({
    where: { id: chat.id },
    data: { lastMessageAt: lastMessageAt ?? chat.lastMessageAt },
  });
  if (lastMessageAt && !chat.isGroup) {
    await prisma.person.updateMany({
      where: { userId: SINGLE_USER_ID, name: { equals: chat.name, mode: "insensitive" } },
      data: { lastContactAt: lastMessageAt },
    });
  }

  if (!aiReady()) {
    return Response.json({ ok: false, error: "AI provider not configured" }, { status: 503 });
  }

  const messages = body.messages.slice(-MAX_MESSAGES).map((m) => ({
    id: String(m.id).slice(0, 80),
    isMe: Boolean(m.isMe),
    // Links, emails and long digit strings are stripped before the text leaves this process.
    text: redact(String(m.text ?? "")).slice(0, MAX_TEXT),
    at: m.at ? new Date(m.at) : new Date(),
  }));

  let created = 0;
  let considered = 0;

  try {
    const { data } = await extractSignals(gemma(), {
      chatName: chat.name,
      messages,
      today: new Date(),
    });

    const rows: Prisma.InboxItemCreateManyInput[] = [];

    for (const event of data.events) {
      considered++;
      if (!worthProposing(event)) continue;
      rows.push({
        userId: SINGLE_USER_ID,
        type: "EVENT",
        chatName: chat.name,
        msgHash: stableHash(`${chat.chatId}|event|${event.title}|${event.date ?? event.dateText ?? ""}|${event.quote}`),
        snippet: user.storeSnippets ? truncate(event.quote, SNIPPET_CHARS) : null,
        payload: {
          personName: event.personName,
          title: event.title,
          date: event.date,
          dateText: event.dateText,
          recurring: event.recurring,
          kind: event.kind,
          details: event.details,
          quote: user.storeSnippets ? truncate(event.quote, SNIPPET_CHARS) : "",
          confidence: event.confidence,
          chatName: chat.name,
        },
      });
    }

    for (const loop of data.loops) {
      considered++;
      if (!worthProposing(loop)) continue;
      rows.push({
        userId: SINGLE_USER_ID,
        type: "OPEN_LOOP",
        chatName: chat.name,
        msgHash: stableHash(`${chat.chatId}|loop|${loop.text}|${loop.quote}`),
        snippet: user.storeSnippets ? truncate(loop.quote, SNIPPET_CHARS) : null,
        payload: {
          personName: loop.personName,
          text: loop.text,
          direction: loop.direction,
          dueDate: loop.dueDate,
          dueText: loop.dueText,
          quote: user.storeSnippets ? truncate(loop.quote, SNIPPET_CHARS) : "",
          confidence: loop.confidence,
          chatName: chat.name,
        },
      });
    }

    console.log(
      `[bridge] ${chat.name}: ${messages.length} message(s) -> ${data.events.length} event(s), ${data.loops.length} loop(s), ${rows.length} worth proposing`,
    );
    if (data.events.length + data.loops.length > rows.length) {
      console.log(
        `[bridge] filtered out:`,
        [...data.events, ...data.loops]
          .filter((s) => !worthProposing(s))
          .map((s) => `confidence=${s.confidence} quote=${JSON.stringify(s.quote.slice(0, 40))}`),
      );
    }
    if (rows.length && user.autoAcceptEvents) {
      // The user asked for these to be filed without review. They still go
      // through InboxItem first, so the record of where each one came from
      // survives, and so a duplicate is still only saved once.
      const inserted = await prisma.inboxItem.createMany({ data: rows, skipDuplicates: true });
      created = inserted.count;
      if (created > 0) {
        const pending = await prisma.inboxItem.findMany({
          where: { userId: SINGLE_USER_ID, status: "PENDING", msgHash: { in: rows.map((r) => r.msgHash) } },
        });
        for (const item of pending) {
          const result = await acceptInboxItem(item.id);
          if (!result.ok) console.log(`[bridge] could not file "${item.id}" automatically: ${result.error}`);
        }
        console.log(`[bridge] filed ${pending.length} item(s) automatically, by person`);
      }
    } else if (rows.length) {
      // skipDuplicates handles the same promise being seen in two polls.
      const result = await prisma.inboxItem.createMany({ data: rows, skipDuplicates: true });
      created = result.count;
      if (created < rows.length) {
        console.log(`[bridge] ${rows.length - created} already seen (same message proposed before)`);
      }
    }
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "extraction failed" },
      { status: 502 },
    );
  }

  if (created > 0) {
    revalidatePath("/inbox");
    revalidatePath("/");
  }
  return Response.json({ ok: true, created, considered });
}
