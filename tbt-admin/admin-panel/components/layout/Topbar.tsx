"use client";

import { UserButton } from "@clerk/nextjs";
import { Bell, Settings } from "lucide-react";
import { usePathname } from "next/navigation";

export function Topbar() {
  const pathname = usePathname();
  
  // Logic to generate breadcrumbs from pathname
  const paths = (pathname || '').split('/').filter(x => x);
  const formattedPaths = paths.map(path => 
    path.charAt(0).toUpperCase() + path.slice(1)
  );

  return (
    <header className="h-[54px] bg-[#111] border-b border-[#2a2a2a] px-7 flex items-center sticky top-0 z-[50] font-sans">
      <div className="flex items-center gap-1.5">
        <span className="font-rajdhani font-bold text-[17px] text-[#e02020] tracking-tight">TBT</span>
        <span className="text-[#333] mx-1">|</span>
        
        <nav className="flex items-center gap-1.5">
          <span className="text-[13px] text-[#a0a0a0] hover:text-[#f0f0f0] cursor-pointer transition-colors font-medium">Dashboard</span>
          {formattedPaths.length > 1 && (
            <>
              <span className="text-[#333] mx-0.5 text-xs">›</span>
              <span className="text-[13px] text-[#a0a0a0] hover:text-[#f0f0f0] cursor-pointer transition-colors font-medium">
                {formattedPaths[0]}
              </span>
              <span className="text-[#333] mx-0.5 text-xs">›</span>
              <span className="text-[13px] text-[#f0f0f0] font-semibold tracking-tight">
                {formattedPaths[formattedPaths.length - 1]}
              </span>
            </>
          )}
        </nav>
      </div>
      
      <div className="ml-auto flex items-center gap-3.5">
        <button className="w-8 h-8 bg-[#1f1f1f] border border-[#2a2a2a] rounded-md flex items-center justify-center text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-[#f0f0f0] transition-all shadow-sm">
          <Bell size={15} strokeWidth={2} />
        </button>
        <button className="w-8 h-8 bg-[#1f1f1f] border border-[#2a2a2a] rounded-md flex items-center justify-center text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-[#f0f0f0] transition-all shadow-sm">
          <Settings size={15} strokeWidth={2} />
        </button>
        <div className="flex items-center border-l border-[#2a2a2a] pl-4 ml-1">
          <UserButton 
            appearance={{
              elements: {
                userButtonAvatarBox: "w-8 h-8 border border-[#333]",
              }
            }}
          />
        </div>
      </div>
    </header>
  );
}
