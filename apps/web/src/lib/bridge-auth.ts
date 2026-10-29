import { safeEqual } from "@/lib/auth";

/**
 * The bridge is a separate process, possibly on another machine, so it cannot use
 * the session cookie. It presents a shared secret instead.
 */
export function bridgeAuthorized(request: Request): boolean {
  const expected = process.env.BRIDGE_SHARED_SECRET;
  if (!expected || expected.length < 8) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token.length > 0 && safeEqual(token, expected);
}

export function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
