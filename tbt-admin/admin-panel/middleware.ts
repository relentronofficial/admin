import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define routes that should be accessible without authentication
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhook(.*)"
]);

export default clerkMiddleware((auth, req) => {
  // If the route is not public, protect it
  if (!isPublicRoute(req)) {
    auth().protect();
  }
});

export const config = {
  // The matcher below ensures that the middleware runs for all requests except for static files
  matcher: [
    '/((?!.*\\..*|_next).*)', 
    '/', 
    '/(api|trpc)(.*)'
  ],
};
