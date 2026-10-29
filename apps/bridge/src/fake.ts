import { FIXTURE_CHATS, FIXTURE_MESSAGES } from "./fixtures/conversation";
import { log } from "./log";
import type { MessageSource, SourceHandlers } from "./source";

/**
 * Fixture mode (WA_FAKE=1). Announces the same chats the seed knows about, and
 * replays their scripted messages whenever you start watching a chat — which is
 * exactly when the real bridge would start seeing that chat's traffic.
 */
export class FakeSource implements MessageSource {
  readonly name = "fixture";
  private handlers: SourceHandlers | null = null;
  private replayed = new Set<string>();

  async start(handlers: SourceHandlers): Promise<void> {
    this.handlers = handlers;
    handlers.onStatus("CONNECTED", { phoneHint: "fixture mode — no WhatsApp account is linked" });
    handlers.onChats(FIXTURE_CHATS);
    log.info("fixture mode: pick a chat in Settings and its scripted messages will arrive.");
  }

  async stop(): Promise<void> {
    this.handlers = null;
  }

  monitoredChanged(monitoredChatIds: string[]): void {
    if (!this.handlers) return;
    for (const chatId of monitoredChatIds) {
      if (this.replayed.has(chatId)) continue;
      const chat = FIXTURE_CHATS.find((c) => c.chatId === chatId);
      const messages = FIXTURE_MESSAGES[chatId];
      if (!chat || !messages) continue;
      this.replayed.add(chatId);
      log.info(`fixture: replaying ${messages.length} messages from ${chat.name}`);
      for (const message of messages) this.handlers.onMessage(chat, message);
    }
    // Stop watching and watching again replays it, which is handy for demos.
    for (const chatId of [...this.replayed]) {
      if (!monitoredChatIds.includes(chatId)) this.replayed.delete(chatId);
    }
  }
}
