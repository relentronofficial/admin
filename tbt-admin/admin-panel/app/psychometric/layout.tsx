"use client";

import "./psychometric.css";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import ToastProvider from "@/components/psychometric/ToastProvider";
import { getToken, LOGIN_PATH } from "@/lib/psychometric/api";

// Psychometric Admin, ported from the standalone Psychometric platform. The
// pages talk to that platform's own API (Express + MongoDB), which has its own
// admin accounts — so on top of the Clerk session, every page except the
// sign-in page needs a Psychometric admin token.
export default function PsychometricLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === LOGIN_PATH;
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (isLogin) return;
    if (!getToken()) {
      router.replace(LOGIN_PATH);
      return;
    }
    setAuthed(true);
  }, [isLogin, pathname, router]);

  return (
    <DashboardLayout>
      <div className="psy-root">
        <ToastProvider>
          {isLogin || authed ? (
            children
          ) : (
            <div className="min-h-[60vh] flex items-center justify-center">
              <div className="spinner" />
            </div>
          )}
        </ToastProvider>
      </div>
    </DashboardLayout>
  );
}
