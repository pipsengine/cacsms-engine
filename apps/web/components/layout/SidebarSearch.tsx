"use client";

export function SidebarSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="enterprise-sidebar-search"><span>SRCH</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search functions..." /></label>;
}
