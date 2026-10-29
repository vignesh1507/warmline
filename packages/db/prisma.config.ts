import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Not env("DATABASE_URL"): that throws on `prisma generate`, which has no
    // business needing a database. The scripts load the root .env first.
    url: process.env.DATABASE_URL ?? "",
  },
});
