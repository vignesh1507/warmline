"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, createSessionToken, passcodeMatches, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";

export async function signIn(formData: FormData) {
  const passcode = String(formData.get("passcode") ?? "");
  const next = String(formData.get("next") ?? "/");
  const destination = next.startsWith("/") ? next : "/";

  if (!passcodeMatches(passcode)) {
    redirect(`/login?error=1&next=${encodeURIComponent(destination)}`);
  }

  const jar = await cookies();
  jar.set(COOKIE_NAME, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect(destination);
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  redirect("/login");
}
