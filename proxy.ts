import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/app/i18n";
import { isValidSession, SESSION_COOKIE } from "@/lib/session";

const LANG_COOKIE = "lang";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Every /admin request (pages and their RSC fetches) needs a valid session, except the login page.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/login" || isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  // /th/... and /en/...: tell the root layout which <html lang> to render and remember the choice for "/".
  const first = pathname.split("/")[1];
  if (isLocale(first)) {
    const headers = new Headers(request.headers);
    headers.set("x-locale", first);
    const res = NextResponse.next({ request: { headers } });
    if (request.cookies.get(LANG_COOKIE)?.value !== first) {
      res.cookies.set(LANG_COOKIE, first, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
    return res;
  }

  // "/" goes to the visitor's last language (temporary redirect); any other unprefixed page is an
  // old Thai URL and moves permanently to /th so existing links and search results keep working.
  const url = request.nextUrl.clone();
  if (pathname === "/") {
    const saved = request.cookies.get(LANG_COOKIE)?.value;
    url.pathname = `/${isLocale(saved) ? saved : defaultLocale}`;
    return NextResponse.redirect(url, 307);
  }
  url.pathname = `/${defaultLocale}${pathname}`;
  return NextResponse.redirect(url, 308);
}

// Pages only: skip API routes, Next internals (/_next, /__nextjs...), uploaded files and anything with a
// file extension (sitemap.xml, robots.txt, icons, /app-demo, /game-media ...).
export const config = { matcher: ["/((?!api/|_|uploads/|.*\\.).*)"] };
