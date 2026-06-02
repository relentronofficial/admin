import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <SignIn
      appearance={{
        elements: {
          card: "shadow-none border border-border rounded-2xl",
          headerTitle: "text-xl font-bold",
          formButtonPrimary:
            "bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold",
          footerActionLink: "text-brand-600 hover:text-brand-700 font-medium",
        },
      }}
    />
  );
}
