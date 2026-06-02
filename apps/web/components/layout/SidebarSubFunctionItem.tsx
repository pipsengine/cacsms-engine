"use client";

import Link from "next/link";
import type { SidebarSubFunction } from "../../lib/navigation/sidebar-config";

export function SidebarSubFunctionItem({ item, active }: { item: SidebarSubFunction; active: boolean }) {
  return <Link className={`enterprise-sidebar-child${active ? " active" : ""}`} href={item.route} aria-current={active ? "page" : undefined}>{item.title}</Link>;
}
