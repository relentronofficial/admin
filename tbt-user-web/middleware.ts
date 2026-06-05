import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/tbt(.*)",
  "/workshops(.*)",
  "/workshop(.*)",
  "/watch(.*)",
  "/Products(.*)",
  "/Resources(.*)",
  "/profile(.*)",
  "/notifications(.*)",
  "/messages(.*)",
  // legacy routes kept for backward compat
  "/dashboard(.*)",
  "/learning(.*)",
  "/programs(.*)",
  "/events(.*)",
  "/live(.*)",
  "/search(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect_url", req.nextUrl.pathname + req.nextUrl.search);
    await auth.protect({
      unauthenticatedUrl: loginUrl.toString(),
    });
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
