import { redirect } from "next/navigation";

/**
 * Root entry point.
 * We use a Server Component for the redirect to ensure it happens 
 * as early as possible and remains compatible with middleware.
 */
export default function RootPage() {
  redirect("/dashboard");
}
