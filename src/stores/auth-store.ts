import { create } from "zustand";
import { User, Company } from "@/lib/types";
import { mockCurrentUser, mockCompany } from "@/lib/mock-data";

interface AuthState {
  user: User | null;
  company: Company | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setCompany: (company: Company | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Pre-populate with mock data for demo
  user: mockCurrentUser,
  company: mockCompany,
  isAuthenticated: true,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setCompany: (company) => set({ company }),
  logout: () => set({ user: null, company: null, isAuthenticated: false }),
}));
