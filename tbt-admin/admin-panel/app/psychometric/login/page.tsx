import { redirect } from "next/navigation";

// There is no separate Psychometric sign-in any more: Psychometric Admin uses
// the TBT Admin session. Old links and bookmarks land on the dashboard.
export default function PsychometricLoginRedirect() {
  redirect("/psychometric/dashboard");
}
