import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The bridge must never be able to act on the user's WhatsApp account.
 *
 * This is the structural guarantee behind that promise: if anyone adds a call
 * that would transmit, mark as read, or set presence, the build fails here. The
 * forbidden names are built at runtime so this file does not contain them
 * literally and fail against itself.
 */
const FORBIDDEN = [
  ["send", "Message"],
  ["send", "Seen"],
  ["send", "Presence", "Available"],
  ["send", "Presence", "Unavailable"],
  ["set", "Status"],
  ["create", "Group"],
  ["accept", "Invite"],
].map((parts) => parts.join(""));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

describe("the bridge is receive-only", () => {
  const files = sourceFiles(join(import.meta.dirname, "..", "src"));

  it("has source files to check", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(FORBIDDEN)("never calls %s", (forbidden) => {
    const offenders = files.filter((file) => readFileSync(file, "utf8").includes(forbidden));
    expect(offenders).toEqual([]);
  });

  it("uses nothing from whatsapp-web.js beyond the client and its login", () => {
    const whatsapp = readFileSync(join(import.meta.dirname, "..", "src", "whatsapp.ts"), "utf8");
    const imports = /const \{([^}]+)\} = whatsappWeb/.exec(whatsapp)?.[1] ?? "";
    const named = imports
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(named.sort()).toEqual(["Client", "LocalAuth"]);
  });
});
