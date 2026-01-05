import { type NextRequest, NextResponse } from "next/server";
import { createGuestToken, GUEST_COOKIE_NAME } from "./lib/guest-token";
import {
  defaultLocale,
  LOCALE_COOKIE_NAME,
  locales,
  type Locale,
} from "./i18n/routing";

/**
 * Middleware to:
 * 1. Detect and set locale based on Accept-Language header or cookie
 * 2. Ensure every visitor gets a guest token
 * 3. Add pathname and locale to headers for Server Components
 */
export async function middleware(request: NextRequest) {
  const start = performance.now();
  const response = NextResponse.next();

  // Detect locale from cookie or Accept-Language header
  let locale = request.cookies.get(LOCALE_COOKIE_NAME)?.value as
    | Locale
    | undefined;

  if (!locale || !locales.includes(locale)) {
    // Parse Accept-Language header
    const acceptLanguage = request.headers.get("accept-language");
    if (acceptLanguage) {
      const preferred = acceptLanguage
        .split(",")
        .map((lang) => lang.split(";")[0].trim().slice(0, 2))
        .find((lang) => locales.includes(lang as Locale));
      locale = (preferred as Locale) || defaultLocale;
    } else {
      locale = defaultLocale;
    }

    // Set locale cookie
    response.cookies.set(LOCALE_COOKIE_NAME, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax",
    });
  }

  // Add locale to headers for Server Components
  response.headers.set("x-locale", locale);

  // Add pathname to headers so Server Components can access it
  response.headers.set("x-pathname", request.nextUrl.pathname);

  // Check if guest cookie already exists
  let existing = request.cookies.get(GUEST_COOKIE_NAME)?.value;
  let guestId: string | null = null;

  let verifyTime = 0;
  if (existing) {
    // Verify and extract guest ID from existing token
    try {
      const t = performance.now();
      const { verifyGuestToken } = await import("./lib/guest-token");
      const verified = await verifyGuestToken(existing);
      verifyTime = performance.now() - t;
      guestId = verified.sid;
    } catch {
      // Invalid token, will create new one
      existing = undefined;
    }
  }

  let createTime = 0;
  if (!existing) {
    // Generate new stable session ID
    const sid = crypto.randomUUID();
    guestId = sid;

    // Create signed guest token
    const t = performance.now();
    const token = await createGuestToken(sid);
    createTime = performance.now() - t;

    // Set cookie with security flags
    response.cookies.set({
      name: GUEST_COOKIE_NAME,
      value: token,
      httpOnly: true, // Not accessible via JavaScript
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      sameSite: "lax", // CSRF protection
      path: "/", // Required for __Host- prefix
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }

  // Pass guest ID to route handlers via header
  if (guestId) {
    response.headers.set("x-guest-id", guestId);
  }

  const total = performance.now() - start;
  if (total > 50) {
    // Only log slow middleware calls
    console.log(
      `[PERF] middleware: ${total.toFixed(1)}ms | ` +
        `verify=${verifyTime.toFixed(1)}ms, create=${createTime.toFixed(1)}ms | ` +
        `path=${request.nextUrl.pathname}`,
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes (next-intl doesn't need to handle these)
     *
     * Note: This matcher handles both i18n routing and guest tokens
     */
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
