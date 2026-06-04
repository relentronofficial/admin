"use client";

import React, { useEffect } from "react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "react-hot-toast";
import { initApiClient } from "@/lib/api/client";
import apiClient from "@/lib/api/client";
import { initSocket, disconnectSocket } from "@/lib/socket/client";
import { SiteConfigProvider } from "@/lib/context/SiteConfigContext";

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

function AuthInterceptor() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      initApiClient(() => getToken());
      initSocket(() => getToken());
      // Retry any queries that errored before this effect ran (auth race on page load).
      queryClient.refetchQueries({ status: 'error' });
      // Ensure a Member record exists for this Clerk user (idempotent)
      getToken().then((token) => {
        if (token) {
          apiClient.post('/api/pub/auth/sync', {}, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {/* non-fatal */});
        }
      });
    } else {
      initApiClient(() => Promise.resolve(null));
      disconnectSocket();
    }
  }, [isLoaded, isSignedIn, getToken]);

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
      signInFallbackRedirectUrl="/tbt"
      signUpFallbackRedirectUrl="/tbt"
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
