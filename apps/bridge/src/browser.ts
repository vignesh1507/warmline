import { accessSync, constants } from "node:fs";
import { execFileSync } from "node:child_process";
import { log } from "./log";

const MAC = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
];

const WINDOWS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
];

const LINUX = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/microsoft-edge",
  "/snap/bin/chromium",
];

function usable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find a Chrome to drive, on whatever machine this is.
 *
 * Order: an explicit path, then Puppeteer's own download if someone asked for
 * it, then the browsers people actually have installed. Returning undefined is
 * fine — Puppeteer will try its default and we print a useful message if that
 * fails too.
 */
export async function resolveChrome(explicit?: string): Promise<string | undefined> {
  if (explicit) {
    if (usable(explicit)) return explicit;
    log.warn(`PUPPETEER_EXECUTABLE_PATH is set to "${explicit}" but that is not an executable file.`);
  }

  try {
    const puppeteer = (await import("puppeteer")) as unknown as { executablePath?: () => string };
    const bundled = puppeteer.executablePath?.();
    if (bundled && usable(bundled)) return bundled;
  } catch {
    /* no bundled browser; carry on */
  }

  const candidates = process.platform === "darwin" ? MAC : process.platform === "win32" ? WINDOWS : LINUX;
  for (const candidate of candidates) {
    if (usable(candidate)) return candidate;
  }

  if (process.platform === "linux") {
    for (const name of ["google-chrome", "chromium", "chromium-browser"]) {
      try {
        const found = execFileSync("which", [name], { encoding: "utf8" }).trim();
        if (found && usable(found)) return found;
      } catch {
        /* not installed */
      }
    }
  }

  log.warn(
    "No Chrome found. Install Chrome, set PUPPETEER_EXECUTABLE_PATH, or run `pnpm chrome:install` from the repo root.",
  );
  return undefined;
}

export function chromeArgs(noSandbox: boolean): string[] {
  const args = ["--disable-dev-shm-usage", "--disable-gpu", "--no-first-run", "--no-default-browser-check"];
  // Only inside a container, where there is no user namespace to sandbox into.
  if (noSandbox) args.push("--no-sandbox", "--disable-setuid-sandbox");
  return args;
}
