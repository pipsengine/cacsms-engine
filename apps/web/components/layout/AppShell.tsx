import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { TopNavigation } from "./TopNavigation";

export function AppShell({ children }: { children: ReactNode }) {
  return <div className="app-shell"><TopNavigation /><Sidebar /><section className="workspace">{children}</section><StatusBar /></div>;
}
