"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RefreshButton() {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  const refresh = () => {
    setSpinning(true);
    router.refresh();
    setTimeout(() => setSpinning(false), 1000);
  };

  return (
    <button
      onClick={refresh}
      className="bg-[#181818] border border-[#2a2a2a] text-[#a0a0a0] hover:text-white hover:border-[#333] text-sm px-3 py-2 rounded-lg transition-colors"
      title="Refresh"
    >
      <span className={spinning ? "inline-block animate-spin" : ""}>↻</span>
    </button>
  );
}
