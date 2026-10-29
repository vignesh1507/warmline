import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

/**
 * One client per process, created on first use.
 *
 * Lazy on purpose: `next build` imports every route to collect its config, and a
 * build has no business needing a database. Connecting on first query instead of
 * on import keeps builds working without a DATABASE_URL, while still failing
 * loudly the moment something actually tries to read data without one.
 *
 * The global cache is for development, where Next reloads modules on every edit
 * and would otherwise open a new pool each time until Postgres refused.
 */
const globalForPrisma = globalThis as unknown as { warmlinePrisma?: PrismaClient };

function create(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env (and run `docker compose up -d db` for a local database).",
    );
  }
  // DigitalOcean's managed Postgres requires TLS; `?sslmode=require` in the URL
  // is enough and needs no CA file, which is why the example URL carries it.
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function client(): PrismaClient {
  if (!globalForPrisma.warmlinePrisma) {
    const instance = create();
    if (process.env.NODE_ENV === "production") return (globalForPrisma.warmlinePrisma = instance);
    globalForPrisma.warmlinePrisma = instance;
  }
  return globalForPrisma.warmlinePrisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = client();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
  has(_target, property) {
    return property in client();
  },
});
