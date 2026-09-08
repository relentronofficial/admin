import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { maskAadhar } from "@/lib/validation";

export const dynamic = "force-dynamic";

const STATUSES = ["all", "pending", "shortlisted", "hired", "rejected"] as const;

type Search = {
  q?: string;
  status?: string;
};

function statusBadgeClass(s: string) {
  switch (s) {
    case "shortlisted":
      return "badge badge-shortlisted";
    case "hired":
      return "badge badge-hired";
    case "rejected":
      return "badge badge-rejected";
    default:
      return "badge badge-pending";
  }
}

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number])
    ? (sp.status as (typeof STATUSES)[number])
    : "all";

  const where = {
    ...(status !== "all" ? { status } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  const [applications, counts] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.application.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const total = counts.reduce((s, c) => s + c._count._all, 0);
  const countMap: Record<string, number> = Object.fromEntries(
    counts.map((c) => [c.status, c._count._all]),
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Applications</h1>
          <p className="text-sm text-slate-500">
            Office Assistant — {total} total submissions
          </p>
        </div>
      </div>

      <form
        method="get"
        className="mb-4 flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200"
      >
        <div className="flex-1 min-w-[220px]">
          <label className="label">Search</label>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Name, email, or phone"
            className="input"
          />
        </div>
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={status} className="select">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "all"
                  ? `All (${total})`
                  : `${s[0].toUpperCase()}${s.slice(1)} (${countMap[s] ?? 0})`}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">Apply</button>
        {(q || status !== "all") && (
          <Link href="/admin" className="btn-ghost">Clear</Link>
        )}
      </form>

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Aadhar</th>
              <th className="px-4 py-3">Experience</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {applications.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  No applications match your filters.
                </td>
              </tr>
            )}
            {applications.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{a.fullName}</div>
                  <div className="text-xs text-slate-500">
                    {a.currentCity}, {a.currentState}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-slate-700">{a.email}</div>
                  <div className="text-xs text-slate-500">{a.phone}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">
                  {maskAadhar(a.aadharNumber)}
                </td>
                <td className="px-4 py-3">{a.experienceYears} yr</td>
                <td className="px-4 py-3">
                  <span className={statusBadgeClass(a.status)}>{a.status}</span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {new Date(a.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/${a.id}`} className="btn-ghost">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
