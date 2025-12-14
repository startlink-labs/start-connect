import { create } from "zustand";

interface HeaderState {
  centerMessage: string | null;
  setCenterMessage: (message: string | null) => void;
}

export const useHeaderStore = create<HeaderState>((set) => ({
  centerMessage: null,
  setCenterMessage: (message) => set({ centerMessage: message }),
}));
