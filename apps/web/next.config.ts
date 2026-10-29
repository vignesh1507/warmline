import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source, including the generated Prisma client.
  transpilePackages: ["@warmline/db", "@warmline/ai", "@warmline/shared"],
  // Native/driver packages stay out of the bundler.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  typedRoutes: false,
};

export default nextConfig;
