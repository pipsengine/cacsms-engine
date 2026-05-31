"use client";

import type { SidebarSubFunction } from "../../lib/navigation/sidebar-config";

export function SidebarSubFunctionItem({ item, active }: { item: SidebarSubFunction; active: boolean }) {
  return <a className={`enterprise-sidebar-child${active ? " active" : ""}`} href={item.route} aria-current={active ? "page" : undefined}>{item.title}</a>;
}
