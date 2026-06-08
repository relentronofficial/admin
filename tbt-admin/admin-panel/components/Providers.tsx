"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import apiClient from "../lib/api/apiClient";
import { initAdminSocket } from "@/lib/socket/client";

function AuthInterceptor() {
  const { getToken, isLoaded } = useAuth();
  const getTokenRef = useRef(getToken);
  initAdminSocket(() => getTokenRef.current());

  // Keep the ref current without triggering interceptor re-registration
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  // Register once when Clerk loads — ref ensures the latest getToken is always used
  useEffect(() => {
    if (!isLoaded) return;

    const interceptor = apiClient.interceptors.request.use(async (config) => {
      try {
        const token = await getTokenRef.current();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.error("Error getting auth token", error);
      }
      return config;
    });

    return () => {
      apiClient.interceptors.request.eject(interceptor);
    };
  }, [isLoaded]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInterceptor />
      {children}
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: "#1a1a1a",
            color: "#f0f0f0",
            border: "1px solid #333",
            fontSize: "14px",
            fontFamily: "var(--font-rajdhani)",
          },
        }}
      />
    </QueryClientProvider>
  );
}
