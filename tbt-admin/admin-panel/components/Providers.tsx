"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import apiClient from "../lib/api/apiClient";
import { initAdminSocket, getAdminSocket } from "@/lib/socket/client";

// Token cache — Clerk tokens are valid for 60s; refresh 8s before expiry
let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;

function AuthInterceptor() {
  const { getToken, isLoaded } = useAuth();
  const getTokenRef = useRef(getToken);
  const queryClient = useQueryClient();
  initAdminSocket(() => getTokenRef.current());

  // Keep the ref current without triggering interceptor re-registration
  useEffect(() => {
    getTokenRef.current = getToken;
    // Invalidate cache when getToken identity changes (e.g., user switch)
    _cachedToken = null;
    _tokenExpiresAt = 0;
  }, [getToken]);

  // Register once when Clerk loads — ref ensures the latest getToken is always used
  useEffect(() => {
    if (!isLoaded) return;

    const interceptor = apiClient.interceptors.request.use(async (config) => {
      try {
        const now = Date.now();
        if (!_cachedToken || now >= _tokenExpiresAt) {
          _cachedToken = await getTokenRef.current();
          _tokenExpiresAt = now + 52_000; // cache for 52s (Clerk default lifetime is 60s)
        }
        if (_cachedToken) {
          config.headers.Authorization = `Bearer ${_cachedToken}`;
        }
      } catch (error) {
        _cachedToken = null;
        _tokenExpiresAt = 0;
      }
      return config;
    });

    return () => {
      _cachedToken = null;
      _tokenExpiresAt = 0;
      apiClient.interceptors.request.eject(interceptor);
    };
  }, [isLoaded]);

  // Global listener — fires regardless of which page the admin is on
  useEffect(() => {
    if (!isLoaded) return;
    let mounted = true;
    getAdminSocket().then((socket) => {
      if (!mounted) return;
      socket.on('admin:member_pending', (data: { fullName: string; phone: string }) => {
        toast.success(`New signup: ${data.fullName} is waiting for approval`);
        queryClient.invalidateQueries({ queryKey: ['members'] });
      });
      socket.on('admin:product_inquiry', (data: { memberName: string; productTitle: string }) => {
        toast.success(`Purchase inquiry: ${data.memberName} is interested in "${data.productTitle}"`);
        queryClient.invalidateQueries({ queryKey: ['product-inquiries'] });
      });
    });
    return () => {
      mounted = false;
      getAdminSocket().then((s) => {
        s.off('admin:member_pending');
        s.off('admin:product_inquiry');
      });
    };
  }, [isLoaded, queryClient]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes — admin data rarely changes faster
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
