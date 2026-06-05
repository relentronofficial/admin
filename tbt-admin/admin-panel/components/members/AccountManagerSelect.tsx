"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, X, Search, Loader2, ChevronDown, User, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateManager } from "@/lib/hooks/useMembers";
import { toast } from "react-hot-toast";

interface Manager {
  id: string;
  fullName: string;
  email: string;
  designation?: string | null;
  role?: string;
}

interface AccountManagerSelectProps {
  managers: Manager[];
  isLoading: boolean;
  value: string;
  onChange: (id: string) => void;
}

interface NewManagerForm {
  fullName: string;
  email: string;
  phone: string;
  designation: string;
}

const EMPTY_FORM: NewManagerForm = { fullName: "", email: "", phone: "", designation: "" };

export function AccountManagerSelect({ managers, isLoading, value, onChange }: AccountManagerSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewManagerForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<NewManagerForm & { submit: string }>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  const createManager = useCreateManager();

  const selectedManager = managers.find(m => m.id === value);
  const filtered = search.trim()
    ? managers.filter(m =>
        m.fullName.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase())
      )
    : managers;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearch("");
  };

  const openModal = () => {
    setIsOpen(false);
    setSearch("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(EMPTY_FORM);
    setFormErrors({});
  };

  const validate = (): boolean => {
    const errors: Partial<NewManagerForm & { submit: string }> = {};
    if (!form.fullName.trim() || form.fullName.trim().length < 2) {
      errors.fullName = "Full name is required (min 2 characters)";
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = "Valid email address is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      const created = await createManager.mutateAsync({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        designation: form.designation.trim() || undefined,
      });
      if (created?.id) {
        onChange(created.id);
      }
      toast.success(`${form.fullName.trim()} added as account manager`);
      closeModal();
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || "Failed to create account manager";
      setFormErrors(prev => ({ ...prev, submit: msg }));
    }
  };

  const field = (key: keyof NewManagerForm) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Trigger button */}
        <button
          type="button"
          onClick={() => setIsOpen(o => !o)}
          className={cn(
            "w-full bg-[#1a1a1a] border rounded-[8px] h-[44px] px-4 text-[14px] outline-none flex items-center justify-between gap-2 transition-colors",
            isOpen ? "border-[#dc2626]" : "border-[#2a2a2a] hover:border-[#444]"
          )}
        >
          {isLoading ? (
            <span className="flex items-center gap-2 text-[#555]">
              <Loader2 size={14} className="animate-spin" /> Loading...
            </span>
          ) : selectedManager ? (
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-full bg-[#dc2626]/15 flex items-center justify-center flex-shrink-0">
                <User size={11} className="text-[#dc2626]" />
              </span>
              <span className="text-white truncate">{selectedManager.fullName}</span>
              <span className="text-[#555] text-[12px] truncate hidden sm:block">
                {selectedManager.designation || selectedManager.email}
              </span>
            </span>
          ) : (
            <span className="text-[#555]">Select account manager...</span>
          )}
          <ChevronDown
            size={15}
            className={cn("text-[#555] flex-shrink-0 transition-transform duration-200", isOpen && "rotate-180")}
          />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute top-[48px] left-0 right-0 bg-[#1c1c1c] border border-[#2a2a2a] rounded-[10px] shadow-[0_8px_32px_rgba(0,0,0,0.6)] z-50 overflow-hidden">
            {/* Search bar */}
            <div className="p-3 border-b border-[#252525]">
              <label className="flex items-center gap-2 bg-[#141414] border border-[#2a2a2a] rounded-[7px] px-3 h-[36px] focus-within:border-[#dc2626]/60 transition-colors">
                <Search size={13} className="text-[#555] flex-shrink-0" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-[13px] text-white placeholder-[#555] outline-none"
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")}>
                    <X size={12} className="text-[#555] hover:text-white" />
                  </button>
                )}
              </label>
            </div>

            {/* Manager list */}
            <div className="max-h-[200px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-[#555]" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <User size={22} className="text-[#333]" />
                  <p className="text-[12px] text-[#555] uppercase tracking-widest font-semibold">
                    {search ? "No results found" : "No account managers found"}
                  </p>
                </div>
              ) : (
                filtered.map(manager => (
                  <button
                    key={manager.id}
                    type="button"
                    onClick={() => handleSelect(manager.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left group"
                  >
                    <span className="w-8 h-8 rounded-full bg-[#dc2626]/10 border border-[#dc2626]/20 flex items-center justify-center flex-shrink-0">
                      <User size={13} className="text-[#dc2626]" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] text-white font-medium group-hover:text-[#dc2626] transition-colors truncate">
                        {manager.fullName}
                      </span>
                      <span className="block text-[11px] text-[#555] truncate">
                        {manager.email}
                        {manager.designation ? ` · ${manager.designation}` : ""}
                      </span>
                    </span>
                    {value === manager.id && (
                      <Check size={14} className="text-[#dc2626] flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Add new button */}
            <div className="border-t border-[#252525] p-2">
              <button
                type="button"
                onClick={openModal}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-[7px] text-[#dc2626] hover:bg-[#dc2626]/10 transition-colors text-[13px] font-bold uppercase tracking-wider"
              >
                <Plus size={15} strokeWidth={2.5} />
                Add New Account Manager
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Manager Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-[200] p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-[#141414] border border-[#252525] rounded-[16px] w-full max-w-[480px] shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-5 border-b border-[#1f1f1f]">
              <div>
                <h3 className="text-[17px] font-bold text-white tracking-tight">Add Account Manager</h3>
                <p className="text-[12px] text-[#666] mt-1">
                  A login account will be created automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#666] hover:text-white hover:bg-[#2a2a2a] transition-colors flex-shrink-0 mt-0.5"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">
                  Full Name <span className="text-[#dc2626]">*</span>
                </label>
                <input
                  {...field("fullName")}
                  placeholder="e.g. Rajesh Kumar"
                  className={cn(
                    "w-full bg-[#1a1a1a] border rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626] transition-colors",
                    formErrors.fullName ? "border-red-500/70" : "border-[#2a2a2a]"
                  )}
                />
                {formErrors.fullName && (
                  <p className="text-[11px] text-red-500 mt-1.5">{formErrors.fullName}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">
                  Email <span className="text-[#dc2626]">*</span>
                </label>
                <input
                  type="email"
                  {...field("email")}
                  placeholder="email@example.com"
                  className={cn(
                    "w-full bg-[#1a1a1a] border rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626] transition-colors",
                    formErrors.email ? "border-red-500/70" : "border-[#2a2a2a]"
                  )}
                />
                {formErrors.email && (
                  <p className="text-[11px] text-red-500 mt-1.5">{formErrors.email}</p>
                )}
              </div>

              {/* Phone + Designation */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Phone</label>
                  <input
                    {...field("phone")}
                    placeholder="+91 9876543210"
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Designation</label>
                  <input
                    {...field("designation")}
                    placeholder="e.g. Account Manager"
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626] transition-colors"
                  />
                </div>
              </div>

              {/* API error */}
              {formErrors.submit && (
                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-[8px] px-4 py-3">
                  <X size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] text-red-400">{formErrors.submit}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="px-6 py-[11px] text-[#888] hover:text-white text-[13px] font-bold uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={createManager.isPending}
                className="bg-[#dc2626] text-white px-6 py-[11px] rounded-[8px] text-[13px] font-bold uppercase tracking-wider hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
              >
                {createManager.isPending && <Loader2 size={14} className="animate-spin" />}
                Save Manager
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
