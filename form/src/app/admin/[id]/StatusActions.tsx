"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["pending", "shortlisted", "hired", "rejected"] as const;

export default function StatusActions({
  id,
  current,
}: {
  id: string;
  current: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(current);
  const [error, setError] = useState<string | null>(null);

  const save = (next: string) => {
    setError(null);
    setStatus(next);
    startTransition(async () => {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        setError("Update failed");
        setStatus(current);
        return;
      }
      router.refresh();
    });
  };

  const remove = () => {
    if (!confirm("Delete this application permanently? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("Delete failed");
        return;
      }
      router.push("/admin");
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs uppercase tracking-wide text-slate-500">
        Status
      </label>
      <select
        className="select w-40"
        value={status}
        disabled={pending}
        onChange={(e) => save(e.target.value)}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s[0].toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
      >
        Delete
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
