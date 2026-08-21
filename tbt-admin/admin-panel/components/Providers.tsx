"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import apiClient from "../lib/api/apiClient";
import { initAdminSocket, getAdminSocket } from "@/lib/socket/client";

// Token cache — read actual exp from JWT so we never use a token past its expiry
let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;

function jwtExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

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
          if (_cachedToken) {
            const exp = jwtExpiry(_cachedToken);
            // Refresh 8s before actual expiry; fall back to 52s if exp unreadable
            _tokenExpiresAt = exp > now + 8_000 ? exp - 8_000 : now + 52_000;
          }
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

    function invalidateAdminNotifs() {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-notifications-unread'] });
    }

    getAdminSocket().then((socket) => {
      if (!mounted) return;
      socket.on('admin:member_pending', (data: { fullName: string; phone: string }) => {
        toast.success(`New signup: ${data.fullName} is waiting for approval`);
        queryClient.invalidateQueries({ queryKey: ['members'] });
        invalidateAdminNotifs();
      });
      socket.on('admin:product_inquiry', (data: { memberName: string; productTitle: string }) => {
        toast.success(`Purchase inquiry: ${data.memberName} is interested in "${data.productTitle}"`);
        queryClient.invalidateQueries({ queryKey: ['product-inquiries'] });
        invalidateAdminNotifs();
      });
      socket.on('admin:workshop_access_request', () => { invalidateAdminNotifs(); });
      socket.on('admin:course_access_request', () => { invalidateAdminNotifs(); });
      socket.on('admin:member_joined', () => { invalidateAdminNotifs(); });
      // Fires when the @zacx BSP returns INSUFFICIENT_BALANCE — no
      // more OTPs can be delivered until the wallet is topped up.
      // Show a persistent error toast (not the default success/info
      // colour) so it's impossible to miss.
      socket.on('admin:whatsapp_low_balance', () => {
        toast.error(
          'WhatsApp OTP delivery halted — @zacx wallet balance exhausted. '
          + 'Top up at zacx.com to restore user logins.',
          { duration: 15000 },
        );
        invalidateAdminNotifs();
      });
      // Onboarding live meetings — keep the /onboarding "Live Meetings" tab
      // reactive without a manual refresh. See ONBOARDING_LIVE_MEETING_SPECKIT.md.
      const invalidateOnboardingMeetings = () => queryClient.invalidateQueries({ queryKey: ['onboarding-meetings'] });
      socket.on('admin:onboarding_meeting_scheduled', invalidateOnboardingMeetings);
      socket.on('admin:onboarding_meeting_started', invalidateOnboardingMeetings);
      socket.on('admin:onboarding_meeting_ended', invalidateOnboardingMeetings);
      socket.on('admin:onboarding_meeting_cancelled', invalidateOnboardingMeetings);
    });
    return () => {
      mounted = false;
      getAdminSocket().then((s) => {
        s.off('admin:member_pending');
        s.off('admin:product_inquiry');
        s.off('admin:workshop_access_request');
        s.off('admin:course_access_request');
        s.off('admin:member_joined');
        s.off('admin:whatsapp_low_balance');
        s.off('admin:onboarding_meeting_scheduled');
        s.off('admin:onboarding_meeting_started');
        s.off('admin:onboarding_meeting_ended');
        s.off('admin:onboarding_meeting_cancelled');
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
