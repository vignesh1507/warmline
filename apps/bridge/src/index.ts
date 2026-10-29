/**
 * The Warmline WhatsApp bridge.
 *
 * It links a WhatsApp Web session, watches only the chats you ticked in
 * Settings, and hands their text to Warmline, which decides what is worth
 * proposing and throws the rest away. It has no path back into WhatsApp: it
 * cannot reply, react, or forward anything.
 *
 * Run it anywhere Node runs — macOS, Windows, Linux or Docker.
 */
import type { BridgeMsg, ChatInfo } from "./api";
import { WarmlineApi } from "./api";
import { loadConfig } from "./config";
import { FakeSource } from "./fake";
import { log } from "./log";
import type { MessageSource } from "./source";
import { WhatsappSource } from "./whatsapp";

const MAX_BUFFERED_PER_CHAT = 80;

type Buffered = { chat: ChatInfo; messages: BridgeMsg[] };

async function main() {
  const cfg = loadConfig();
  const api = new WarmlineApi(cfg);

  log.info(`Warmline bridge — ${cfg.fake ? "fixture mode" : "WhatsApp Web"}`);
  log.info(`talking to ${cfg.webApiUrl}`);

  const buffers = new Map<string, Buffered>();
  let monitored = new Set<string>();
  let monitorAll = false;

  const watching = (chatId: string) => monitorAll || monitored.has(chatId);

  const source: MessageSource = cfg.fake ? new FakeSource() : new WhatsappSource(cfg);

  await source.start({
    onStatus: (status, extra) => {
      void api.reportStatus(status, extra);
    },
    onChats: (chats) => {
      void api.offerChats(chats).catch((err) => log.warn("could not offer chats:", err.message));
    },
    onMessage: (chat, message) => {
      if (!watching(chat.chatId)) return;
      const entry = buffers.get(chat.chatId) ?? { chat, messages: [] };
      entry.chat = chat;
      entry.messages.push(message);
      if (entry.messages.length > MAX_BUFFERED_PER_CHAT) {
        entry.messages.splice(0, entry.messages.length - MAX_BUFFERED_PER_CHAT);
      }
      buffers.set(chat.chatId, entry);
    },
  });

  // Ask Warmline what we are allowed to see, repeatedly, so revoking consent in
  // Settings takes effect here within seconds.
  async function refreshPermission() {
    const remote = await api.getConfig();
    if (!remote) return;
    const wasMonitorAll = monitorAll;
    monitorAll = Boolean(remote.monitorAll);
    const next = new Set(remote.monitoredChatIds);
    const changed =
      next.size !== monitored.size || [...next].some((id) => !monitored.has(id));
    monitored = next;

    // Anything no longer permitted is dropped from memory immediately.
    for (const chatId of [...buffers.keys()]) {
      if (!watching(chatId)) buffers.delete(chatId);
    }
    if (monitorAll !== wasMonitorAll) {
      log.info(monitorAll ? "watching every chat, as you asked" : "back to watching only the chats you ticked");
    } else if (changed && !monitorAll) {
      log.info(
        monitored.size === 0
          ? "no chats are being watched"
          : `watching: ${remote.monitoredChats.map((c) => c.name).join(", ")}`,
      );
    }
    source.monitoredChanged?.([...monitored]);
  }

  async function flush() {
    for (const [chatId, entry] of [...buffers.entries()]) {
      if (!watching(chatId) || entry.messages.length === 0) continue;
      const messages = entry.messages.splice(0, entry.messages.length);
      const result = await api.handOverMessages(entry.chat, messages);
      if (result && result.created > 0) {
        log.info(`${entry.chat.name}: ${result.created} thing(s) waiting in your inbox`);
      }
    }
  }

  await refreshPermission();
  const permissionTimer = setInterval(() => void refreshPermission(), cfg.pollSeconds * 1000);
  const flushTimer = setInterval(() => void flush(), cfg.flushSeconds * 1000);
  const chatTimer = setInterval(() => {
    if (source instanceof WhatsappSource) void source.refreshChats();
  }, cfg.chatRefreshMinutes * 60_000);

  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`${signal} — stopping`);
    clearInterval(permissionTimer);
    clearInterval(flushTimer);
    clearInterval(chatTimer);
    await flush().catch(() => undefined);
    await api.reportStatus("DISCONNECTED");
    await source.stop();
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch(async (err) => {
  log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
