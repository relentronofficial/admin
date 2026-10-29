import { redirect } from "next/navigation";

// The member onboarding quiz that used to live here moved to /onboarding-quiz.
export default function PsychometricIndex() {
  redirect("/psychometric/dashboard");
}
