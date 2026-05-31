"use client";

import type { SidebarFunction } from "../../lib/navigation/sidebar-config";
import { SidebarSubFunctionItem } from "./SidebarSubFunctionItem";

export function SidebarFunctionItem({ item, expanded, pathname, onToggle }: { item: SidebarFunction; expanded: boolean; pathname: string; onToggle: () => void }) {
  const active = item.children.some((child) => child.route === pathname);
  return <section className={`enterprise-sidebar-function${active ? " active" : ""}`}>
    <button type="button" className="enterprise-sidebar-parent" onClick={onToggle} aria-expanded={expanded}>
      <span className="function-number">{item.number}</span><span className="function-icon">{item.icon}</span><strong>{item.title}</strong>
      {item.status ? <b>{item.status}</b> : null}<i>{expanded ? "v" : ">"}</i>
    </button>
    {expanded ? <div className="enterprise-sidebar-children">{item.children.map((child) => <SidebarSubFunctionItem item={child} active={child.route === pathname} key={child.id} />)}</div> : null}
  </section>;
}
