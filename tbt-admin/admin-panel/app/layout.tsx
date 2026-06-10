import { ClerkProvider } from "@clerk/nextjs";
import { Inter, Rajdhani, DM_Sans } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import "@livekit/components-styles";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "TBT Admin",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const rajdhani = Rajdhani({ 
  subsets: ["latin"], 
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-rajdhani" 
});
const dmSans = DM_Sans({ 
  subsets: ["latin"], 
  variable: "--font-dm-sans" 
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <html lang="en" className={cn(
        inter.variable, 
        rajdhani.variable, 
        dmSans.variable,
        "antialiased font-sans"
      )}>
        <body className="bg-[#0d0404] text-white min-h-screen antialiased">
          <Providers>
            {children}
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
