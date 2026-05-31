"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { sidebarFunctions } from "../../lib/navigation/sidebar-config";
import { useSidebarStore } from "../../store/sidebar-store";
import { SidebarFunctionItem } from "./SidebarFunctionItem";
import { SidebarSearch } from "./SidebarSearch";

export function EnterpriseSidebar() {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const { collapsed, expanded, toggleCollapsed, toggleFunction } = useSidebarStore();
  const filtered = sidebarFunctions.filter((item) => `${item.title} ${item.children.map((child) => child.title).join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  return <aside className={`sidebar enterprise-sidebar${collapsed ? " is-collapsed" : ""}`}>
    <div className="sidebar-heading">CONTROL SYSTEMS</div>
    {!collapsed ? <SidebarSearch value={query} onChange={setQuery} /> : null}
    <nav aria-label="Functions and sub-functions">{filtered.map((item) => <SidebarFunctionItem item={item} expanded={!collapsed && Boolean(expanded[item.id])} pathname={pathname} onToggle={() => toggleFunction(item.id)} key={item.id} />)}</nav>
    <button className="enterprise-sidebar-collapse" type="button" onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? ">" : "<"}</button>
  </aside>;
}
