import { NextResponse, type NextRequest } from "next/server";
import { checkBasicAuth, unauthorized } from "@/lib/auth";

export function proxy(req: NextRequest) {
  if (!checkBasicAuth(req)) return unauthorized();
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
