import type { BridgeConfig } from "./config";
import { log } from "./log";

export type ChatInfo = { chatId: string; name: string; isGroup?: boolean; lastMessageAt?: string | null };
export type BridgeMsg = { id: string; isMe: boolean; text: string; at: string };
export type BridgeStatus = "DISCONNECTED" | "QR_PENDING" | "AUTHENTICATING" | "CONNECTED" | "ERROR";

export type RemoteConfig = {
  monitoredChatIds: string[];
  monitoredChats: { chatId: string; name: string }[];
  storeSnippets: boolean;
  pollSeconds: number;
};

/**
 * The bridge's only outside connection. It posts what it sees to Warmline and
 * asks which chats it is allowed to look at — nothing else, and never to WhatsApp.
 */
export class WarmlineApi {
  constructor(private cfg: BridgeConfig) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.cfg.webApiUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.cfg.secret}`,
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`${path} -> ${res.status} ${text.slice(0, 200)}`);
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  /** Reports the bridge's own connection state to Warmline. */
  async reportStatus(status: BridgeStatus, extra: { qrDataUrl?: string; phoneHint?: string; lastError?: string; fake?: boolean } = {}) {
    try {
      await this.request("/api/bridge/status", {
        method: "POST",
        body: JSON.stringify({ status, fake: this.cfg.fake, ...extra }),
      });
    } catch (err) {
      log.warn("could not report status:", (err as Error).message);
    }
  }

  async getConfig(): Promise<RemoteConfig | null> {
    try {
      return await this.request<RemoteConfig>("/api/bridge/config");
    } catch (err) {
      log.warn("could not read config:", (err as Error).message);
      return null;
    }
  }

  /** Offers chat names to Warmline so the user can pick which to watch. */
  async offerChats(chats: ChatInfo[]): Promise<void> {
    if (chats.length === 0) return;
    await this.request("/api/bridge/chats", { method: "POST", body: JSON.stringify({ chats }) });
  }

  /** Hands text to Warmline, which reads it and discards it; only proposals are kept. */
  async handOverMessages(chat: ChatInfo, messages: BridgeMsg[]): Promise<{ created: number } | null> {
    try {
      return await this.request<{ created: number }>("/api/bridge/messages", {
        method: "POST",
        body: JSON.stringify({
          chatId: chat.chatId,
          chatName: chat.name,
          isGroup: chat.isGroup ?? false,
          messages,
        }),
      });
    } catch (err) {
      log.warn(`could not hand over ${messages.length} message(s) from ${chat.name}:`, (err as Error).message);
      return null;
    }
  }
}
