"use client";

import "./psychometric.css";
import { useEffect, useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import ToastProvider from "@/components/psychometric/ToastProvider";
import { api, setAuthTokenGetter, type ApiEnvelope } from "@/lib/psychometric/api";

// Psychometric Admin, ported from the former standalone Psychometric platform
// and now served by the TBT backend with the admin's TBT (Clerk) session — no
// separate sign-in. The backend enforces Admin / Super Admin on every request;
// this check only picks the screen to show.
type Access = "checking" | "allowed" | "denied" | "signed-out" | "not-connected" | "error";

export default function PsychometricLayout({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<Access>("checking");
  // Wait for Clerk: on a refresh or direct URL this layout mounts before the
  // session is restored, and a check sent then carries no token (401). Until
  // Clerk is loaded the spinner shows; the check runs once it is.
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const clerk = useClerk();

  // Psychometric requests use the same token source as the rest of TBT Admin
  // (useAuth's getToken). Registered during render so it is in place before
  // any page's first request; cleared when leaving the section.
  setAuthTokenGetter(getToken);
  useEffect(() => () => setAuthTokenGetter(null), []);

  useEffect(() => {
    if (!isLoaded) return;
    // Clerk itself says the session has ended: back to the main TBT Admin
    // sign-in, returning here afterwards (one login for the whole admin).
    if (!isSignedIn) {
      setAccess("signed-out");
      void clerk.redirectToSignIn({ redirectUrl: window.location.href });
      return;
    }
    let alive = true;
    setAccess("checking");
    (async () => {
      const { ok, status, data } = await api.get<ApiEnvelope<{ allowed: boolean; configured: boolean }>>("/access");
      if (!alive) return;
      if (status === 403) setAccess("denied");
      else if (status === 401) setAccess("signed-out");
      else if (!ok) setAccess("error");
      else setAccess(data.data?.configured ? "allowed" : "not-connected");
    })();
    return () => { alive = false; };
  }, [isLoaded, isSignedIn, clerk]);

  // Only reached when the backend still rejects the session after a fresh
  // token: let the admin sign in again through the main TBT Admin sign-in.
  const signInAgain = () =>
    void clerk.signOut({ redirectUrl: `/sign-in?redirect_url=${encodeURIComponent(window.location.href)}` });

  return (
    <DashboardLayout>
      <div className="psy-root">
        <ToastProvider>
          {access === "allowed" ? children : <AccessScreen access={access} onSignIn={signInAgain} />}
        </ToastProvider>
      </div>
    </DashboardLayout>
  );
}

function AccessScreen({ access, onSignIn }: { access: Access; onSignIn: () => void }) {
  if (access === "checking") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }
  const text = {
    denied: ["No access", "Psychometric Admin is available to Admin and Super Admin only."],
    "signed-out": ["Session couldn't be verified", "Your TBT Admin sign-in couldn't be verified. Please sign in again, then reopen this page."],
    "not-connected": ["Not connected yet", "Psychometric Admin hasn't been connected to the Psychometric service yet. Ask a Super Admin to set the Psychometric bridge key."],
    error: ["Couldn't load Psychometric Admin", "Please check your connection and reload the page."],
  }[access as Exclude<Access, "checking" | "allowed">];
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="card max-w-md text-center">
        <h2 className="text-lg font-bold mb-2" style={{ color: "var(--tbt-text)" }}>{text[0]}</h2>
        <p className="text-sm" style={{ color: "var(--tbt-muted)" }}>{text[1]}</p>
        {access === "signed-out" && (
          <button className="btn btn-primary btn-sm mt-4" onClick={onSignIn}>Sign in again</button>
        )}
        {access === "error" && (
          <button className="btn btn-outline btn-sm mt-4" onClick={() => window.location.reload()}>Reload</button>
        )}
      </div>
    </div>
  );
}
