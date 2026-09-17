import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Auth cookies (tbt_access / tbt_refresh) are set by the backend with no Domain
// attribute, so they are scoped to the backend Cloud Run origin and are invisible
// to this middleware (which runs on the user-web origin). All authentication
// decisions happen client-side in SubscriptionGate via useMe() / the Axios
// 401-interceptor, not here. This middleware exists only so Next.js skips the
// matcher for static assets and API routes.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon|api/|login|signup|verify|loading|sign-in|sign-up|[^?]*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|woff2?|js|css)).*)",
  ],
};
