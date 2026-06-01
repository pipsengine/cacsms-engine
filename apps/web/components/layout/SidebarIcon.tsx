const iconPaths: Record<string, string> = {
  LayoutDashboard: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  Workflow: "M3 3h6v6H3zM15 15h6v6h-6zM9 6h4a4 4 0 0 1 4 4v5M15 18h-4a4 4 0 0 1-4-4V9",
  ClipboardCheck: "M9 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3M9 3h6v4H9zm0 11 2 2 4-4",
  Radar: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 5 6-6",
  ScanSearch: "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M11 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm2.5 5.5 3 3",
  LineChart: "M3 3v18h18M7 16l4-5 4 3 5-7",
  Camera: "M14.5 4 16 6h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l1.5-2zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  Brain: "M12 4H9.5A3.5 3.5 0 0 0 6 7.5c0 .3 0 .6.1.8A3.5 3.5 0 0 0 4 11.5c0 1.4.8 2.7 2 3.2A3.5 3.5 0 0 0 9.5 20H12zm0 0h2.5A3.5 3.5 0 0 1 18 7.5c0 .3 0 .6-.1.8a3.5 3.5 0 0 1 .1 6.4 3.5 3.5 0 0 1-3.5 5.3H12z",
  MessagesSquare: "M7 18H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1M7 18l-3 3v-5M10 9h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1l2 2M14 13h3",
  Target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2z",
  ShieldAlert: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zm0-14v4m0 4h.01",
  PlayCircle: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-2 5 6 4-6 4z",
  Briefcase: "M3 6h18v14H3zM8 6V4h8v2M3 12h18M10 12v2h4v-2",
  DatabaseZap: "M20 5c0 1.7-3.6 3-8 3s-8-1.3-8-3 3.6-3 8-3 8 1.3 8 3zM4 5v6c0 1.7 3.6 3 8 3m-8-3v6c0 1.7 3.6 3 8 3m4-6-2 3h3l-1 4 4-5h-3l1-2z",
  Server: "M3 4h18v6H3zM3 14h18v6H3zM7 7h.01M7 17h.01",
  MonitorSmartphone: "M2 3h14v11H2zM7 18h7M9 14v4M17 8h5v11h-5z",
  Activity: "M3 12h4l3-7 4 14 3-7h4",
  FileBarChart: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 0v6h6M8 17v-3m4 3v-6m4 6v-2",
  ShieldCheck: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zm-3-10 2 2 4-4",
  Settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0-6v2m0 14v2m9-9h-2M5 12H3m15.4-6.4L17 7m-10 10-1.4 1.4m12.8 0L17 17M7 7 5.6 5.6"
};

export function SidebarIcon({ name }: { name: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d={iconPaths[name]} /></svg>;
}
