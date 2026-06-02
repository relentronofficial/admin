import type { Metadata } from "next";
import { LoginScreen } from "@/components/auth/LoginScreen";

export const metadata: Metadata = {
  title: "Sign In | TBT",
  description: "Sign in to your Tamil Business Tribe account.",
};

export default function LoginPage() {
  return <LoginScreen />;
}
