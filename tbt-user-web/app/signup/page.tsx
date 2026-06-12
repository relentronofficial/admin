import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupScreen } from "@/components/auth/SignupScreen";

export const metadata: Metadata = {
  title: "Sign Up | TBT",
  description: "Create your Tamil Business Tribe account.",
};

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupScreen />
    </Suspense>
  );
}
