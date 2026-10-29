import { resolve } from "node:path";

export type BridgeConfig = {
  webApiUrl: string;
  secret: string;
  fake: boolean;
  sessionDir: string;
  chromePath: string | undefined;
  noSandbox: boolean;
  headless: boolean;
  pollSeconds: number;
  flushSeconds: number;
  chatRefreshMinutes: number;
};

export function loadConfig(env = process.env): BridgeConfig {
  const webApiUrl = (env.WEB_API_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");
  const secret = env.BRIDGE_SHARED_SECRET || "";
  if (!secret || secret.length < 8) {
    throw new Error(
      "BRIDGE_SHARED_SECRET is missing (or too short). It must match the one the web app uses — see .env.example.",
    );
  }
  return {
    webApiUrl,
    secret,
    fake: env.WA_FAKE === "1" || env.WA_FAKE === "true",
    sessionDir: resolve(env.WA_SESSION_DIR || ".wa-session"),
    chromePath: env.PUPPETEER_EXECUTABLE_PATH || undefined,
    noSandbox: env.WA_CHROME_NO_SANDBOX === "true" || env.WA_CHROME_NO_SANDBOX === "1",
    // WhatsApp Web sometimes refuses to finish loading in a headless browser.
    // WA_HEADLESS=false shows the window so you can see what it is doing, and
    // scan the QR straight from it.
    headless: env.WA_HEADLESS !== "false" && env.WA_HEADLESS !== "0",
    pollSeconds: Number(env.WA_POLL_SECONDS || 15),
    flushSeconds: Number(env.WA_FLUSH_SECONDS || 20),
    chatRefreshMinutes: Number(env.WA_CHAT_REFRESH_MINUTES || 10),
  };
}
