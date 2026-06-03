"use client";

import { useEffect } from "react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "react-hot-toast";
import { initApiClient } from "@/lib/api/client";
import { SiteConfigProvider } from "@/lib/context/SiteConfigContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthInterceptor() {
  const { getToken } = useAuth();

  useEffect(() => {
    initApiClient(() => getToken());
  }, [getToken]);

  return null;
}

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ClerkProvider
      signInUrl="/login"
      signUpUrl="/sign-up"
      afterSignInUrl="/tbt"
      afterSignUpUrl="/tbt"
    >
      <QueryClientProvider client={queryClient}>
        <AuthInterceptor />
        <SiteConfigProvider>
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
    </ClerkProvider>
  );
}
