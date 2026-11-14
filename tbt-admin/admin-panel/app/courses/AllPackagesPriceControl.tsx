"use client";

import { useEffect, useState } from "react";
import { Loader2, Package } from "lucide-react";
import { toast } from "react-hot-toast";
import { useGetSiteConfig, useUpdateSiteConfig } from "@/lib/hooks/useTbt";

// Global "All Packages" price (site_configs.all_packages_price): the All Packages
// plan — every published mini course in one purchase — shown on every mini course
// page at this price. A course's own "All Packages Price" field overrides it.
export function AllPackagesPriceControl() {
  const { data, isLoading } = useGetSiteConfig();
  const update = useUpdateSiteConfig();
  const saved: number | null = (data as any)?.data?.allPackagesPrice ?? null;
  const [value, setValue] = useState("");

  useEffect(() => {
    setValue(saved != null ? String(saved) : "");
  }, [saved]);

  const dirty = value.trim() !== (saved != null ? String(saved) : "");

  const save = async () => {
    const trimmed = value.trim();
    if (trimmed !== "" && !(Number(trimmed) > 0)) {
      toast.error("Enter a price above ₹0, or leave it empty to turn All Packages off");
      return;
    }
    try {
      await update.mutateAsync({ allPackagesPrice: trimmed === "" ? null : Number(trimmed) });
      toast.success(trimmed === "" ? "All Packages turned off" : "All Packages price saved");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save All Packages price");
    }
  };

  return (
    <div
      className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md pl-3 pr-1.5 h-[42px]"
      title="Price of the All Packages plan (every published mini course) shown on every mini course page. A course's own All Packages Price overrides it."
    >
      <Package size={14} className="text-purple-400 shrink-0" />
      <span className="text-[11px] font-bold uppercase tracking-widest text-[#888] font-rajdhani whitespace-nowrap">All Packages ₹</span>
      <input
        type="number"
        min="0"
        value={value}
        disabled={isLoading}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && dirty) void save(); }}
        placeholder="Off"
        aria-label="Global All Packages price in rupees"
        className="w-24 bg-[#141414] border border-[#333] rounded h-8 px-2 text-white text-sm outline-none focus:border-purple-500"
      />
      <button
        onClick={save}
        disabled={!dirty || update.isPending}
        className="h-8 px-3 rounded bg-purple-600 text-white text-[11px] font-bold font-rajdhani uppercase tracking-widest hover:bg-purple-700 disabled:opacity-30 transition-all flex items-center gap-1.5"
      >
        {update.isPending && <Loader2 size={12} className="animate-spin" />}
        Save
      </button>
    </div>
  );
}
