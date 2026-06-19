"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "react-hot-toast";
import { SiteConfigProvider } from "@/lib/context/SiteConfigContext";
import type { SiteConfig, NavItem, UiStrings } from "@/types";
import type { RightIcons } from "@/lib/context/SiteConfigContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});

interface ProvidersProps {
  children: React.ReactNode;
  initialConfig?: SiteConfig | null;
  initialNav?: { items: NavItem[]; rightIcons: RightIcons } | null;
  initialUiStrings?: UiStrings | null;
}

export function Providers({
  children,
  initialConfig,
  initialNav,
  initialUiStrings,
}: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <SiteConfigProvider
        initialConfig={initialConfig}
        initialNav={initialNav}
        initialUiStrings={initialUiStrings}
      >
        {children}
      </SiteConfigProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "hsl(var(--card))",
            color: "hsl(var(--card-foreground))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "14px",
          },
        }}
      />
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
