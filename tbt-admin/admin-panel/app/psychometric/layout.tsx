"use client";

import "./psychometric.css";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import ToastProvider from "@/components/psychometric/ToastProvider";
import { api, type ApiEnvelope } from "@/lib/psychometric/api";

// Psychometric Admin, ported from the former standalone Psychometric platform
// and now served by the TBT backend with the admin's TBT (Clerk) session — no
// separate sign-in. The backend enforces Admin / Super Admin on every request;
// this check only picks the screen to show.
type Access = "checking" | "allowed" | "denied" | "not-connected" | "error";

export default function PsychometricLayout({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<Access>("checking");

  useEffect(() => {
    let alive = true;
    (async () => {
      const { ok, status, data } = await api.get<ApiEnvelope<{ allowed: boolean; configured: boolean }>>("/access");
      if (!alive) return;
      if (status === 403) setAccess("denied");
      else if (!ok) setAccess("error");
      else setAccess(data.data?.configured ? "allowed" : "not-connected");
    })();
    return () => { alive = false; };
  }, []);

  return (
    <DashboardLayout>
      <div className="psy-root">
        <ToastProvider>
          {access === "allowed" ? children : <AccessScreen access={access} />}
        </ToastProvider>
      </div>
    </DashboardLayout>
  );
}

function AccessScreen({ access }: { access: Access }) {
  if (access === "checking") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }
  const text = {
    denied: ["No access", "Psychometric Admin is available to Admin and Super Admin only."],
    "not-connected": ["Not connected yet", "Psychometric Admin hasn't been connected to the Psychometric service yet. Ask a Super Admin to set the Psychometric bridge key."],
    error: ["Couldn't load Psychometric Admin", "Please check your connection and reload the page."],
  }[access as Exclude<Access, "checking" | "allowed">];
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="card max-w-md text-center">
        <h2 className="text-lg font-bold mb-2" style={{ color: "var(--tbt-text)" }}>{text[0]}</h2>
        <p className="text-sm" style={{ color: "var(--tbt-muted)" }}>{text[1]}</p>
      </div>
    </div>
  );
}
