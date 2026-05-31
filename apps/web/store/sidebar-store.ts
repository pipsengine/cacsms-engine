"use client";

import { create } from "zustand";
import { sidebarFunctions } from "../lib/navigation/sidebar-config";

type SidebarState = {
  collapsed: boolean;
  expanded: Record<string, boolean>;
  toggleCollapsed: () => void;
  toggleFunction: (id: string) => void;
};

export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: false,
  expanded: Object.fromEntries(sidebarFunctions.map((item) => [item.id, Boolean(item.defaultExpanded)])),
  toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
  toggleFunction: (id) => set((state) => ({ expanded: { ...state.expanded, [id]: !state.expanded[id] } }))
}));
