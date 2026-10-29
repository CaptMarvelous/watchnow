import { NextResponse, type NextRequest } from "next/server";
import { findSession, SESSION_COOKIE } from "@/lib/auth/session";

/**
 * Redirects signed-out visitors away from account-only pages before any
 * rendering starts, so it's a clean HTTP redirect rather than a client-side
 * one. (A streamed page can't change its status code after it starts
 * sending, so a redirect() called deep inside a page that's already
 * streaming - which is what requireUser() would otherwise rely on, given the
 * app's root loading.tsx - degrades to a slower <meta refresh> fallback.)
 *
 * Each protected page's own requireUser() check still runs afterwards and
 * remains the actual authorization boundary; this is a fast, friendly
 * redirect for the common case, not a substitute for it. See the Proxy
 * execution-order note about Server Functions not being separate routes:
 * a matcher covering a page also covers the server actions posted to it.
 */
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await findSession(token) : null;
  if (session) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/library/:path*", "/import/:path*", "/account/:path*"],
};
