"use client";

import { useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Users,
  TrendingUp,
  BookOpen,
  Video,
  ShieldCheck,
  Calendar,
  MessageSquare
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getAdminSocket } from "@/lib/socket/client";
import { cn } from "@/lib/utils";

const stats = [
  { label: "Total Members", value: "2,840", growth: "+12.5%", icon: Users, color: "text-[#e02020]" },
  { label: "Active Courses", value: "48", growth: "+2", icon: BookOpen, color: "text-blue-500" },
  { label: "Upcoming Webinars", value: "12", growth: "4 today", icon: Video, color: "text-purple-500" },
  { label: "Support Tickets", value: "24", growth: "-15%", icon: MessageSquare, color: "text-orange-500" },
];

export default function DashboardPage() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    getAdminSocket().then((socket) => {
      if (!mounted) return;
      socket.on('admin:member_joined', (data: { memberId: string; fullName: string; createdAt: string }) => {
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
        toast.success(`New member joined: ${data.fullName}`);
      });
    });
    return () => {
      mounted = false;
      getAdminSocket().then((s) => s.off('admin:member_joined'));
    };
  }, [queryClient]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex gap-2.5 items-start mb-8">
          <div className="w-0.5 bg-[#e02020] rounded-sm min-h-[40px]" />
          <div>
            <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0]">Dashboard Overview</h1>
            <p className="text-[12px] text-[#606060] font-medium uppercase tracking-wider font-rajdhani">Welcome back, Sakthi. Here is what is happening today.</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5 shadow-lg hover:border-[#333] transition-colors group">
              <div className="flex justify-between items-start mb-4">
                <div className={cn("p-2 rounded-lg bg-[#1f1f1f] border border-[#333]", stat.color)}>
                  <stat.icon size={20} />
                </div>
                <span className="text-[10px] font-bold text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                  {stat.growth}
                </span>
              </div>
              <p className="text-[11px] uppercase tracking-widest text-[#606060] font-bold mb-1">{stat.label}</p>
              <h3 className="font-rajdhani text-3xl font-bold text-[#f0f0f0] tracking-tight">{stat.value}</h3>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          {/* Recent Activity */}
          <section className="lg:col-span-2 bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-xl">
            <div className="px-6 pt-[18px] pb-[14px] border-b border-[#2a2a2a] flex items-center gap-3">
              <div className="w-0.5 bg-[#e02020] h-5 flex-shrink-0" />
              <h3 className="font-rajdhani text-lg font-semibold tracking-wide uppercase">Recent System Activity</h3>
            </div>
            <div className="p-6 text-center py-20">
              <p className="text-[#606060] text-sm italic">System logs and activity tracking will appear here...</p>
            </div>
          </section>

          {/* Quick Actions / Status */}
          <section className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-xl">
            <div className="px-6 pt-[18px] pb-[14px] border-b border-[#2a2a2a] flex items-center gap-3">
              <div className="w-0.5 bg-[#e02020] h-5 flex-shrink-0" />
              <h3 className="font-rajdhani text-lg font-semibold tracking-wide uppercase">Server Status</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between bg-[#1f1f1f] border border-[#2a2a2a] p-4 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  <span className="text-sm font-medium">Main Database</span>
                </div>
                <span className="text-[10px] font-bold text-[#606060] uppercase tracking-widest">Active</span>
              </div>
              <div className="flex items-center justify-between bg-[#1f1f1f] border border-[#2a2a2a] p-4 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  <span className="text-sm font-medium">Clerk Auth Service</span>
                </div>
                <span className="text-[10px] font-bold text-[#606060] uppercase tracking-widest">Active</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
