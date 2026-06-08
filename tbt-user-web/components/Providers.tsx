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

function AuthInterceptor({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      // Register token getter immediately so queries can start without waiting for sync.
      initApiClient(() => getToken());
      initSocket(() => getToken());

      // Sync member record + device telemetry in the background — does NOT block render.
      getToken().then((token) => {
        if (!token) return;
        let deviceId = localStorage.getItem("tbt_device_id");
        if (!deviceId) {
          deviceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
          localStorage.setItem("tbt_device_id", deviceId);
        }
        apiClient.post('/api/pub/auth/sync', {}, {
          headers: { Authorization: `Bearer ${token}`, 'x-device-id': deviceId },
        })
        .then(() => {
          // Retry any queries that failed before sync completed (e.g. member not yet created).
          queryClient.refetchQueries({ predicate: (q) => q.state.status === 'error' });
        })
        .catch(() => {});
      });
    } else {
      initApiClient(() => Promise.resolve(null));
      disconnectSocket();
    }
  }, [isLoaded, isSignedIn, getToken, queryClient]);

  return <>{children}</>;
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
        <SiteConfigProvider>
          <AuthInterceptor>
            {children}
          </AuthInterceptor>
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
