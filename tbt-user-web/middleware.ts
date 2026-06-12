import { NextResponse, NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  // Auth is enforced client-side by SubscriptionGate.
  // The tbt_access cookie is HttpOnly and set by the backend (run.app domain),
  // so it is never visible here at the vercel.app domain — checking it would
  // always redirect authenticated users back to /login.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
