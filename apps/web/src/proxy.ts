import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, sessionTokenIsValid } from "./lib/auth";

/**
 * Everything is private by default. The bridge endpoints authenticate themselves
 * with a shared secret instead of the session cookie, so they are skipped here
 * and checked in their own handlers.
 *
 * (Next 16 renamed the `middleware` convention to `proxy`.)
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (await sessionTokenIsValid(request.cookies.get(COOKIE_NAME)?.value)) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    /*
     * Protect every page and API route except:
     *   login, the bridge API (shared-secret authed), and static assets.
     */
    "/((?!login|api/bridge|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)",
  ],
};
