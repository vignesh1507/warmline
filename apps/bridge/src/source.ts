import type { BridgeMsg, BridgeStatus, ChatInfo } from "./api";

export type SourceHandlers = {
  onStatus(status: BridgeStatus, extra?: { qrDataUrl?: string; phoneHint?: string; lastError?: string }): void;
  onChats(chats: ChatInfo[]): void;
  onMessage(chat: ChatInfo, message: BridgeMsg): void;
};

/**
 * Where messages come from. Two implementations: the real WhatsApp Web session,
 * and a fixture replay for demos and tests. Neither can send anything.
 */
export interface MessageSource {
  readonly name: string;
  start(handlers: SourceHandlers): Promise<void>;
  stop(): Promise<void>;
  /** Called when the set of chats the user permits changes. */
  monitoredChanged?(monitoredChatIds: string[]): void;
}
