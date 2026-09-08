import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Office Assistant Applications",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="h-8 w-8 rounded bg-brand-600 text-white grid place-items-center text-sm font-bold">
              OA
            </span>
            <span className="font-semibold text-slate-900">Admin</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-slate-600 hover:text-slate-900">
              Public form
            </Link>
            <Link href="/admin" className="text-slate-600 hover:text-slate-900">
              Applications
            </Link>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
