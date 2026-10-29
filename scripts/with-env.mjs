#!/usr/bin/env node
/**
 * Runs a command with the workspace's root .env loaded.
 *
 * Why this exists: one .env at the repo root is far kinder than one per package,
 * but Next.js and Prisma each only look in their own directory. This walks up to
 * the workspace root, loads .env and .env.local if they are there, and never
 * overrides a variable that is already set — so on Render, where there is no
 * .env file and the platform supplies real environment variables, it does nothing
 * at all instead of failing.
 *
 * Usage: node ../../scripts/with-env.mjs next dev
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function findWorkspaceRoot(start) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function parseEnv(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, "").trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

const root = findWorkspaceRoot(process.cwd());
if (root) {
  // .env first, then .env.local on top; neither overrides the real environment.
  for (const file of [".env", ".env.local"]) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    for (const [key, value] of Object.entries(parseEnv(readFileSync(path, "utf8")))) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

// Make workspace binaries runnable even when this script is invoked directly
// (pnpm already does this for its own scripts).
const binDirs = [join(process.cwd(), "node_modules", ".bin")];
if (root) binDirs.push(join(root, "node_modules", ".bin"));
const sep = process.platform === "win32" ? ";" : ":";
process.env.PATH = [...binDirs, process.env.PATH ?? ""].filter(Boolean).join(sep);

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("with-env: nothing to run. Usage: node scripts/with-env.mjs <command> [args...]");
  process.exit(2);
}

const child = spawn(command, args, {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
child.on("error", (err) => {
  console.error(`with-env: could not run "${command}": ${err.message}`);
  process.exit(1);
});
