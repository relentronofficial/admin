import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Office Assistant — Job Application",
  description:
    "Apply for the Office Assistant position. Fill out the form and upload the required documents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
