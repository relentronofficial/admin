import { NextResponse, NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/tbt",
  "/workshops",
  "/workshop",
  "/watch",
  "/Products",
  "/Resources",
  "/profile",
  "/notifications",
  "/messages",
  // legacy routes
  "/dashboard",
  "/learning",
  "/programs",
  "/events",
  "/live",
  "/search",
];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected) {
    const accessToken = req.cookies.get("tbt_access")?.value;
    if (!accessToken) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect_url", pathname + search);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
