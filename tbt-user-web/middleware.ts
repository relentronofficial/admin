import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function middleware(request: NextRequest) {
  const tbtAccess = request.cookies.get("tbt_access")?.value;
  const tbtRefresh = request.cookies.get("tbt_refresh")?.value;

  // Access token present — nothing to do
  if (tbtAccess || !tbtRefresh) return NextResponse.next();

  try {
    const refreshRes = await fetch(`${API_BASE}/api/user-auth/refresh`, {
      method: "POST",
      headers: { Cookie: `tbt_refresh=${tbtRefresh}` },
    });

    if (!refreshRes.ok) return NextResponse.next();

    const setCookieHeader = refreshRes.headers.get("set-cookie") ?? "";
    const match = setCookieHeader.match(/tbt_access=([^;]+)/);
    if (!match) return NextResponse.next();

    const newAccessToken = match[1];

    // Inject new cookie into the forwarded request so RSC cookies() sees it
    const requestHeaders = new Headers(request.headers);
    const existingCookies = request.headers.get("cookie") ?? "";
    requestHeaders.set(
      "cookie",
      existingCookies
        ? `${existingCookies}; tbt_access=${newAccessToken}`
        : `tbt_access=${newAccessToken}`
    );

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    // Write the refreshed token back to the browser
    response.headers.append("set-cookie", setCookieHeader);
    return response;
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals, static files, and auth/public pages
    "/((?!_next/static|_next/image|favicon|api/|login|signup|verify|loading|sign-in|sign-up|[^?]*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|woff2?|js|css)).*)",
  ],
};
