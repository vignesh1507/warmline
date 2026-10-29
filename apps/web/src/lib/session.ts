import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma, SINGLE_USER_ID, type User } from "@warmline/db";
import { COOKIE_NAME, sessionTokenIsValid } from "./auth";

export async function isSignedIn(): Promise<boolean> {
  const jar = await cookies();
  return sessionTokenIsValid(jar.get(COOKIE_NAME)?.value);
}

/** Pages and actions call this first; everything below it can trust the session. */
export async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) redirect("/login");
}

/**
 * The single user row, created on first run so a fresh database needs no setup
 * step beyond the migration.
 */
export async function getUser(): Promise<User> {
  return prisma.user.upsert({
    where: { id: SINGLE_USER_ID },
    update: {},
    create: { id: SINGLE_USER_ID },
  });
}

export async function requireUser(): Promise<User> {
  await requireSession();
  return getUser();
}
