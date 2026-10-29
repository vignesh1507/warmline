import type { BridgeMsg, ChatInfo } from "../api";

/**
 * A scripted conversation, used when WA_FAKE=1. It exists so the whole WhatsApp
 * path — chat consent, extraction, inbox, accepting — can be demonstrated and
 * tested without linking a real account.
 *
 * The chat ids match the ones the seed script creates.
 */
export const FIXTURE_CHATS: ChatInfo[] = [
  { chatId: "demo-maya@c.us", name: "Maya", isGroup: false },
  { chatId: "demo-arjun@c.us", name: "Arjun", isGroup: false },
  { chatId: "demo-flatmates@g.us", name: "Flat 302", isGroup: true },
];

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

export const FIXTURE_MESSAGES: Record<string, BridgeMsg[]> = {
  "demo-maya@c.us": [
    { id: "fx-maya-1", isMe: false, text: "the balcony is completely overrun now, three kinds of chilli", at: minutesAgo(50) },
    { id: "fx-maya-2", isMe: true, text: "ha! I'll dig out that seed guide and send it over this week", at: minutesAgo(48) },
    { id: "fx-maya-3", isMe: false, text: "please do. also my sister's wedding is on the 12th of December, you're coming", at: minutesAgo(45) },
    { id: "fx-maya-4", isMe: true, text: "wouldn't miss it", at: minutesAgo(44) },
  ],
  "demo-arjun@c.us": [
    { id: "fx-arjun-1", isMe: false, text: "housewarming saturday, come by around 7", at: minutesAgo(120) },
    { id: "fx-arjun-2", isMe: true, text: "I'll be there. want me to bring the coffee filter thing?", at: minutesAgo(118) },
    { id: "fx-arjun-3", isMe: false, text: "yes please, mine is still in a box somewhere", at: minutesAgo(117) },
    { id: "fx-arjun-4", isMe: false, text: "also I still have your drill, remind me", at: minutesAgo(115) },
  ],
  "demo-flatmates@g.us": [
    { id: "fx-flat-1", isMe: false, text: "bins", at: minutesAgo(30) },
    { id: "fx-flat-2", isMe: false, text: "😂", at: minutesAgo(29) },
    { id: "fx-flat-3", isMe: true, text: "done", at: minutesAgo(28) },
  ],
};
