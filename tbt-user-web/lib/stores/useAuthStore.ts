import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Member } from "@/types";

interface AuthState {
  member: Member | null;
  setMember: (member: Member | null) => void;
  clearMember: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      member: null,
      setMember: (member) => set({ member }),
      clearMember: () => set({ member: null }),
    }),
    {
      name: "tbt-user-auth",
      partialize: (state) => ({ member: state.member }),
    }
  )
);
