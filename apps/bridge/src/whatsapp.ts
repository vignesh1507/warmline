import { mkdirSync } from "node:fs";
import qrcode from "qrcode";
import qrTerminal from "qrcode-terminal";
// whatsapp-web.js is CommonJS, so Node's ESM loader cannot pick named exports
// out of it. Take the default and destructure exactly what is needed.
import whatsappWeb from "whatsapp-web.js";
import type { BridgeMsg, ChatInfo } from "./api";
import { chromeArgs, resolveChrome } from "./browser";
import type { BridgeConfig } from "./config";
import { log } from "./log";
import type { MessageSource, SourceHandlers } from "./source";

const { Client, LocalAuth } = whatsappWeb;
type WhatsappClient = InstanceType<typeof Client>;

const MAX_CHATS = 200;

/**
 * A linked WhatsApp Web session, driven through Chrome.
 *
 * Read-only by construction: this file subscribes to events and never calls any
 * method that would transmit anything. A test in the repo fails the build if
 * that ever changes.
 *
 * Note this is an unofficial route — WhatsApp publishes no API for a personal
 * account — so it can break when WhatsApp changes their web client.
 */
export class WhatsappSource implements MessageSource {
  readonly name = "whatsapp-web";
  private client: WhatsappClient | null = null;
  private handlers: SourceHandlers | null = null;
  private monitored = new Set<string>();

  constructor(private cfg: BridgeConfig) {}

  async start(handlers: SourceHandlers): Promise<void> {
    this.handlers = handlers;
    mkdirSync(this.cfg.sessionDir, { recursive: true });

    const executablePath = await resolveChrome(this.cfg.chromePath);
    log.info(`session folder: ${this.cfg.sessionDir}`);
    log.info(`browser: ${executablePath ?? "puppeteer default"}`);

    const client = new Client({
      authStrategy: new LocalAuth({ dataPath: this.cfg.sessionDir }),
      puppeteer: {
        headless: this.cfg.headless,
        executablePath,
        args: chromeArgs(this.cfg.noSandbox),
      },
    });
    this.client = client;

    client.on("qr", async (qr: string) => {
      log.info("scan this with WhatsApp → Settings → Linked devices (it also appears in Warmline Settings):");
      qrTerminal.generate(qr, { small: true });
      try {
        const qrDataUrl = await qrcode.toDataURL(qr, { margin: 1, width: 320 });
        handlers.onStatus("QR_PENDING", { qrDataUrl });
      } catch {
        handlers.onStatus("QR_PENDING");
      }
    });

    client.on("authenticated", () => {
      log.info("linked — loading your chats");
      handlers.onStatus("AUTHENTICATING");
    });

    client.on("auth_failure", (message: string) => {
      log.error("authentication failed:", message);
      handlers.onStatus("ERROR", { lastError: `WhatsApp refused the link: ${message}` });
    });

    client.on("ready", async () => {
      const phoneHint = client.info?.wid?.user ? `linked to …${String(client.info.wid.user).slice(-4)}` : undefined;
      handlers.onStatus("CONNECTED", { phoneHint });
      log.info("connected. Nothing is read until you tick a chat in Warmline Settings.");
      await this.pushChats();
    });

    client.on("disconnected", (reason: string) => {
      log.warn("disconnected:", reason);
      handlers.onStatus("DISCONNECTED", { lastError: String(reason) });
    });

    // message_create covers both sides of the conversation, which matters: half
    // the promises worth tracking are ones the user made themselves.
    client.on("message_create", (message) => this.handleMessage(message));

    await client.initialize();
  }

  async stop(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.handlers = null;
    if (!client) return;
    try {
      await client.destroy();
    } catch {
      /* shutting down anyway */
    }
  }

  monitoredChanged(monitoredChatIds: string[]): void {
    this.monitored = new Set(monitoredChatIds);
  }

  private async pushChats(): Promise<void> {
    if (!this.client || !this.handlers) return;
    try {
      const chats = await this.client.getChats();
      const list: ChatInfo[] = chats
        .filter((chat) => chat.id?._serialized && chat.id._serialized !== "status@broadcast")
        .slice(0, MAX_CHATS)
        .map((chat) => ({
          chatId: chat.id._serialized,
          name: chat.name || chat.id.user || "Unknown",
          isGroup: Boolean(chat.isGroup),
          lastMessageAt: chat.timestamp ? new Date(chat.timestamp * 1000).toISOString() : null,
        }));
      this.handlers.onChats(list);
      log.info(`offered ${list.length} chats for you to choose from (names only)`);
    } catch (err) {
      log.warn("could not list chats:", (err as Error).message);
    }
  }

  async refreshChats(): Promise<void> {
    await this.pushChats();
  }


  /**
   * Which chat a message belongs to.
   *
   * getChat() reaches into WhatsApp Web's own store, which breaks whenever they
   * ship a change their library hasn't caught up with — it fails with a minified
   * one-letter error. The message itself already carries everything needed, so
   * that is the fallback, and it keeps working when the store call does not.
   */
  private async describeChat(message: {
    fromMe?: boolean;
    from?: string;
    to?: string;
    _data?: { notifyName?: string };
    getChat: () => Promise<{ id: { _serialized: string }; name?: string; isGroup?: boolean }>;
  }): Promise<ChatInfo | null> {
    try {
      const chat = await message.getChat();
      if (chat?.id?._serialized) {
        return {
          chatId: chat.id._serialized,
          name: chat.name || chat.id._serialized.split("@")[0] || "Unknown",
          isGroup: Boolean(chat.isGroup),
        };
      }
    } catch {
      /* fall through to the message's own fields */
    }

    const chatId = (message.fromMe ? message.to : message.from) ?? "";
    if (!chatId) return null;
    const isGroup = chatId.endsWith("@g.us");
    // notifyName is the other person's WhatsApp display name; for a chat you
    // started, fall back to the number so the entry is still recognisable.
    const name = (!isGroup && message._data?.notifyName) || chatId.split("@")[0] || "Unknown";
    return { chatId, name, isGroup };
  }

  private async handleMessage(message: {
    id?: { _serialized?: string };
    body?: string;
    type?: string;
    hasMedia?: boolean;
    fromMe?: boolean;
    timestamp?: number;
    from?: string;
    to?: string;
    _data?: { notifyName?: string };
    getChat: () => Promise<{ id: { _serialized: string }; name?: string; isGroup?: boolean }>;
  }): Promise<void> {
    if (!this.handlers) return;
    // Text only. Photos, voice notes, documents and reactions are never touched.
    if (message.type !== "chat" || message.hasMedia) return;
    const text = (message.body ?? "").trim();
    if (!text) return;

    const info = await this.describeChat(message);
    if (!info || info.chatId === "status@broadcast") return;

    // Offer the chat so it can be ticked in Settings. Names and ids only.
    this.handlers.onChats([info]);

    // Consent gate, on this side too: an unticked chat is never even buffered.
    if (!this.monitored.has(info.chatId)) return;

    this.handlers.onMessage(info, {
      id: message.id?._serialized ?? `${info.chatId}-${message.timestamp ?? Date.now()}`,
      isMe: Boolean(message.fromMe),
      text,
      at: new Date((message.timestamp ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    });
  }
}
