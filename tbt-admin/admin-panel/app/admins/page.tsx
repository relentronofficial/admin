"use client";

import { useState } from "react";
import { 
  Search, 
  Plus, 
  MoreVertical, 
  Filter, 
  Download,
  ChevronLeft,
  ChevronRight,
  User,
  Shield,
  Mail,
  Phone,
  Calendar,
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListAdmins, useMe } from "@/lib/hooks/useAdmin";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function AdminsListPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const limit = 10;

  const { data: me, isLoading: isLoadingMe } = useMe();
  const { data, isLoading, isError } = useListAdmins({ page, limit, search });

  const admins = data?.data || [];
  const total = data?.meta?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Guard: Ensure no rendering until auth state is resolved
  if (isLoadingMe || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-40">
          <Loader2 size={40} className="animate-spin text-[#e02020]" />
        </div>
      </DashboardLayout>
    );
  }

  const formatLabel = (value: string) =>
    value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'inactive': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'suspended': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'pending_approval': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'text-[#e02020] border-[#e02020]/30 bg-[#e02020]/5';
      case 'admin': return 'text-orange-500 border-orange-500/30 bg-orange-500/5';
      case 'account_manager': return 'text-blue-500 border-blue-500/30 bg-blue-500/5';
      case 'mentor': return 'text-green-500 border-green-500/30 bg-green-500/5';
      case 'moderator': return 'text-purple-500 border-purple-500/30 bg-purple-500/5';
      default: return 'text-gray-400 border-gray-400/30 bg-gray-400/5';
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6 font-sans">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-3 items-start">
            <div className="w-1 bg-[#e02020] rounded-full min-h-[44px]" />
            <div>
              <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Administrative Access</h1>
              <p className="text-[12px] text-[#606060] font-medium uppercase tracking-[1px] font-rajdhani">Manage system administrators and their operational permissions.</p>
            </div>
          </div>

          <button 
            onClick={() => router.push("/admins/create")}
            className="flex items-center gap-2 bg-[#e02020] text-white px-6 py-2.5 rounded-md font-rajdhani font-bold text-[13px] tracking-[1.5px] uppercase hover:bg-[#ff3a3a] transition-all shadow-[0_0_20px_rgba(224,32,32,0.2)] active:scale-95 shrink-0"
          >
            <Plus size={16} strokeWidth={3} />
            Create New Admin
          </button>
        </div>

        {/* Stats Summary - Optional but good for UI parity */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           {[
             { label: 'Total Admins', value: total, icon: Shield, color: 'text-[#e02020]' },
             { label: 'Active Sessions', value: admins.filter((a:any) => a.status === 'active').length, icon: Clock, color: 'text-green-500' },
             { label: 'Super Admins', value: admins.filter((a:any) => a.role === 'super_admin').length, icon: User, color: 'text-blue-500' },
             { label: 'Pending Review', value: 0, icon: Filter, color: 'text-yellow-500' }
           ].map((stat, i) => (
             <div key={i} className="bg-[#181818] border border-[#2a2a2a] p-4 rounded-xl flex items-center gap-4">
               <div className={cn("p-2.5 rounded-lg bg-[#1a1a1a] border border-[#333]", stat.color)}>
                 <stat.icon size={20} />
               </div>
               <div>
                 <p className="text-[10px] text-[#606060] uppercase font-bold tracking-wider font-rajdhani">{stat.label}</p>
                 <p className="text-xl font-bold text-[#f0f0f0] font-rajdhani">{stat.value}</p>
               </div>
             </div>
           ))}
        </div>

        {/* Table/List Section */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-2xl">
          
          {/* Controls Bar */}
          <div className="p-4 border-b border-[#2a2a2a] flex flex-col md:flex-row gap-4 items-center justify-between bg-[#1a1a1a]/50">
            <div className="relative w-full md:w-[400px]">
              <input 
                type="text" 
                placeholder="SEARCH BY NAME, EMAIL OR ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#141414] border border-[#333] rounded-md py-2.5 pl-10 pr-4 text-[12px] font-rajdhani font-bold tracking-wider outline-none focus:border-[#e02020] transition-all text-[#f0f0f0] placeholder:text-[#444]"
              />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#141414] border border-[#333] rounded-md text-[11px] font-bold text-[#a0a0a0] font-rajdhani uppercase tracking-widest hover:border-[#606060] transition-all">
                <Filter size={14} /> Filter
              </button>
              <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#141414] border border-[#333] rounded-md text-[11px] font-bold text-[#a0a0a0] font-rajdhani uppercase tracking-widest hover:border-[#606060] transition-all">
                <Download size={14} /> Export
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto min-h-[400px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 size={40} className="animate-spin text-[#e02020]" />
                <p className="text-[11px] text-[#606060] font-bold tracking-[2px] uppercase font-rajdhani">Accessing Database...</p>
              </div>
            ) : isError ? (
              <div className="text-center py-20 space-y-4">
                <XCircle size={40} className="mx-auto text-[#e02020] opacity-50" />
                <p className="text-[#e02020] font-rajdhani font-bold uppercase tracking-widest">Connection Error</p>
                <p className="text-[12px] text-[#606060]">Failed to retrieve admin records. Please try again.</p>
              </div>
            ) : admins.length === 0 ? (
               <div className="text-center py-20 space-y-4">
                <User size={40} className="mx-auto text-[#333]" />
                <p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest">No Records Found</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1a1a1a] border-b border-[#2a2a2a]">
                    <th className="px-6 py-4 text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Admin Profile</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">System ID</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani text-center">Status</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Privilege</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Department</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani text-right">Last Login</th>
                    <th className="px-6 py-4 w-[50px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a2a]">
                  {admins.map((admin: any) => (
                    <tr key={admin.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#1f1f1f] border border-[#333] flex-shrink-0 overflow-hidden relative group-hover:border-[#e02020]/30 transition-colors">
                            {admin.profilePhotoUrl ? (
                              <img src={admin.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#333]">
                                <User size={20} />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-[13.5px] font-bold text-[#f0f0f0] group-hover:text-[#e02020] transition-colors">{admin.fullName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                               <Mail size={10} className="text-[#444]" />
                               <p className="text-[11px] text-[#606060] truncate max-w-[150px]">{admin.email}</p>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-rajdhani font-bold text-[12px] tracking-[1px] text-[#a0a0a0] bg-[#1a1a1a] px-2 py-1 rounded border border-[#333]">
                          {admin.employeeId}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider font-rajdhani",
                          getStatusColor(admin.status)
                        )}>
                          {admin.status === 'active' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                          {formatLabel(admin.status || '')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded border text-[11px] font-bold font-rajdhani tracking-wider uppercase",
                          getRoleColor(admin.role)
                        )}>
                          <Shield size={10} />
                          {formatLabel(admin.role || '')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-[12px] text-[#f0f0f0] font-medium">{admin.designation || 'N/A'}</p>
                          <p className="text-[10px] text-[#606060] uppercase tracking-wider font-rajdhani mt-0.5">{admin.department || 'General'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-[11px] text-[#f0f0f0] font-medium font-rajdhani">
                          {admin.lastLoginAt ? format(new Date(admin.lastLoginAt), 'dd MMM yyyy') : 'Never'}
                        </p>
                        <p className="text-[9px] text-[#606060] uppercase tracking-tighter mt-0.5 font-rajdhani">
                          {admin.lastLoginAt ? format(new Date(admin.lastLoginAt), 'HH:mm:ss') : '--:--:--'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-[#444] hover:text-white p-1 rounded hover:bg-[#2a2a2a] transition-all">
                          <MoreVertical size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {!isLoading && admins.length > 0 && (
            <div className="px-6 py-4 border-t border-[#2a2a2a] bg-[#1a1a1a]/30 flex items-center justify-between">
              <p className="text-[11px] text-[#606060] font-medium uppercase tracking-[1px] font-rajdhani">
                Showing <span className="text-[#a0a0a0] font-bold">{(page-1)*limit + 1}</span> to <span className="text-[#a0a0a0] font-bold">{Math.min(page*limit, total)}</span> of <span className="text-[#a0a0a0] font-bold">{total}</span> system operators
              </p>
              
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => setPage(p => Math.max(1, p-1))}
                  disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center bg-[#141414] border border-[#333] rounded text-[#606060] hover:text-white disabled:opacity-20 disabled:hover:text-[#606060] transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                
                {[...Array(totalPages)].map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setPage(i+1)}
                    className={cn(
                      "w-8 h-8 rounded text-[11px] font-bold font-rajdhani transition-all",
                      page === i+1 
                        ? "bg-[#e02020] text-white border border-[#e02020] shadow-[0_0_10px_rgba(224,32,32,0.3)]" 
                        : "bg-[#141414] border border-[#333] text-[#606060] hover:border-[#606060]"
                    )}
                  >
                    {i+1}
                  </button>
                ))}

                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p+1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center bg-[#141414] border border-[#333] rounded text-[#606060] hover:text-white disabled:opacity-20 disabled:hover:text-[#606060] transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
