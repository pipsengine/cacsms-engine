"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  AlertCircle,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Filter,
  Gauge,
  History,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  LogOut,
  Menu,
  MoreHorizontal,
  Pause,
  Play,
  Power,
  Search,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  User,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  activeRole,
  findModuleByTitle,
  modules,
  platformIntegrations,
  type Module,
  type ResolvedPage,
  type Role,
  visibleModules,
  findPageByPath,
} from "@/lib/navigation";

type StatusTone = "success" | "warning" | "danger" | "neutral" | "info";

const metrics = [
  { label: "Total Equity", value: "$248,920", delta: "+2.8%", tone: "success" as const },
  { label: "Balance", value: "$241,300", delta: "Synced", tone: "info" as const },
  { label: "Floating P/L", value: "+$7,620", delta: "12 open", tone: "success" as const },
  { label: "Daily P/L", value: "+$1,840", delta: "0.74%", tone: "success" as const },
  { label: "Open Trades", value: "12", delta: "4 symbols", tone: "warning" as const },
  { label: "AI Confidence", value: "86%", delta: "Hybrid mode", tone: "info" as const },
];

type LinkedRecord = {
  id: string;
  symbol: string;
  status: string;
  owner: string;
  risk: string;
  link: string;
};

const records: LinkedRecord[] = [
  { id: "tradeId TRD-1048", symbol: "XAUUSD", status: "Protected", owner: "AI Hybrid", risk: "0.8%", link: "/trade-management/open-trades" },
  { id: "decisionId DEC-8841", symbol: "EURUSD", status: "Awaiting Execution", owner: "AI Decision Engine", risk: "0.5%", link: "/ai-decision-engine/recommendations" },
  { id: "alertId ALT-3317", symbol: "GBPJPY", status: "News Risk", owner: "Risk Engine", risk: "High", link: "/alerts/news" },
  { id: "accountId ACC-2201", symbol: "FTMO-100K", status: "Compliant", owner: "Prop Account", risk: "3.1% DD", link: "/risk-management/prop-firm-rules" },
];

const timeline = [
  { title: "AI decision DEC-8841 approved", detail: "Institutional and retail confluence aligned on EURUSD.", time: "09:42" },
  { title: "MT5 bridge heartbeat received", detail: "C# WebSocket bridge acknowledged order routing channel.", time: "09:41" },
  { title: "Risk policy evaluated", detail: "Prop firm daily loss and correlation exposure passed.", time: "09:39" },
  { title: "Audit event AUD-9173 created", detail: "User action signed through ASP.NET Identity with MFA context.", time: "09:38" },
];

const workflowLinks = [
  { label: "Market opportunity", href: "/market-intelligence/watchlist" },
  { label: "AI validation", href: "/ai-decision-engine/entry-validation" },
  { label: "Execute order", href: "/trade-execution/order-setup" },
  { label: "Manage trade", href: "/trade-management/open-trades" },
  { label: "Risk review", href: "/risk-management/dashboard" },
  { label: "Report outcome", href: "/reports/daily" },
  { label: "Learning note", href: "/learning-center/trade-journal" },
];

export function CommandCenterPage({ path }: { path: string }) {
  const page = findPageByPath(path);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Operations");

  if (!page) {
    return null;
  }

  const title = page.submodule?.title ?? page.module.title;
  const description = page.submodule
    ? `${page.module.description} This workspace focuses on ${page.submodule.title.toLowerCase()} and links related records across the command center.`
    : page.module.description;

  const linkedModules = page.module.linkedModules
    .map(findModuleByTitle)
    .filter((module): module is Module => Boolean(module));

  const pageRecords = useMemo(() => {
    return records.map((record, index) => ({
      ...record,
      status: index === 1 && page.module.title === "AI Decision Engine" ? "Ready to Execute" : record.status,
    }));
  }, [page.module.title]);

  return (
    <AppLayout
      collapsed={sidebarCollapsed}
      onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
      topbar={<Topbar onOpenDrawer={() => setDrawerOpen(true)} />}
      sidebar={<Sidebar collapsed={sidebarCollapsed} currentPath={page.path} />}
    >
      <Breadcrumbs page={page} />
      <PageHeader
        module={page.module}
        title={title}
        description={description}
        onOpenDrawer={() => setDrawerOpen(true)}
        onConfirm={() => setConfirmOpen(true)}
      />

      <section className="status-strip" aria-label="Platform integrations">
        {platformIntegrations.map((integration) => (
          <StatusPill key={integration.label} icon={integration.icon} label={integration.label} value={integration.value} />
        ))}
      </section>

      <section className="metric-grid">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="content-grid">
        <div className="main-stack">
          <FilterPanel />
          <Tabs activeTab={activeTab} onChange={setActiveTab} tabs={["Operations", "Records", "Analytics", "Audit Trail"]} />
          {activeTab === "Operations" && <OperationsPanel module={page.module} />}
          {activeTab === "Records" && <DataTable records={pageRecords} />}
          {activeTab === "Analytics" && <ChartPanel module={page.module} />}
          {activeTab === "Audit Trail" && <Timeline />}
        </div>

        <aside className="side-stack">
          <LinkedRecordPanel modules={linkedModules} fallback={page.module} />
          <QuickActions module={page.module} onOpenDrawer={() => setDrawerOpen(true)} onConfirm={() => setConfirmOpen(true)} />
          <StatePanels />
        </aside>
      </section>

      <DetailDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} module={page.module} title={title} />
      <ConfirmModal open={confirmOpen} onClose={() => setConfirmOpen(false)} module={page.module} />
    </AppLayout>
  );
}

function AppLayout({
  children,
  sidebar,
  topbar,
  collapsed,
  onToggleSidebar,
}: {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  collapsed: boolean;
  onToggleSidebar: () => void;
}) {
  return (
    <div className={clsx("app-shell", collapsed && "sidebar-collapsed")}>
      {sidebar}
      <div className="workspace">
        <div className="mobile-toggle">
          <button className="icon-button" onClick={onToggleSidebar} aria-label="Toggle sidebar">
            <Menu size={18} />
          </button>
        </div>
        {topbar}
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ collapsed, currentPath }: { collapsed: boolean; currentPath: string }) {
  const items = visibleModules(activeRole);

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div className="brand-mark">AI</div>
        {!collapsed && (
          <div>
            <strong>CACSMS</strong>
            <span>Forex Command</span>
          </div>
        )}
      </div>
      <nav className="sidebar-nav" aria-label="Primary modules">
        {items.map((module) => (
          <SidebarGroup key={module.path} module={module} currentPath={currentPath} collapsed={collapsed} />
        ))}
      </nav>
    </aside>
  );
}

function SidebarGroup({ module, currentPath, collapsed }: { module: Module; currentPath: string; collapsed: boolean }) {
  const [open, setOpen] = useState(currentPath.startsWith(module.path));
  const Icon = module.icon;
  const active = currentPath === module.path || currentPath.startsWith(`${module.path}/`);

  return (
    <div className="sidebar-group">
      <div className={clsx("sidebar-row", active && "active")}>
        <Link href={module.path} className="sidebar-link" title={module.title}>
          <Icon size={18} />
          {!collapsed && <span>{module.title}</span>}
        </Link>
        {!collapsed && (
          <button className="sidebar-expander" onClick={() => setOpen((value) => !value)} aria-label={`Toggle ${module.title}`}>
            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        )}
      </div>
      {!collapsed && open && (
        <div className="sidebar-subitems">
          {module.submodules.map((submodule) => (
            <Link key={submodule.path} className={clsx("sidebar-subitem", currentPath === submodule.path && "active")} href={submodule.path}>
              {submodule.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Topbar({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  return (
    <header className="topbar">
      <SearchInput />
      <div className="topbar-actions">
        <StatusBadge tone="success">System Online</StatusBadge>
        <StatusBadge tone="success">MT5 Connected</StatusBadge>
        <StatusBadge tone="info">Prop Account</StatusBadge>
        <button className="icon-button" aria-label="Notifications" onClick={onOpenDrawer}>
          <Bell size={18} />
          <span className="notification-dot" />
        </button>
        <button className="profile-button" aria-label="User profile">
          <User size={18} />
          <span>Super Admin</span>
          <ChevronDown size={15} />
        </button>
      </div>
    </header>
  );
}

function SearchInput() {
  return (
    <label className="search-input">
      <Search size={18} />
      <input placeholder="Search tradeId, decisionId, symbolId, accountId, alertId..." />
    </label>
  );
}

function Breadcrumbs({ page }: { page: ResolvedPage }) {
  return (
    <div className="breadcrumbs">
      <Link href="/dashboard">Dashboard</Link>
      <ChevronRight size={14} />
      <Link href={page.module.path}>{page.module.title}</Link>
      {page.submodule && (
        <>
          <ChevronRight size={14} />
          <span>{page.submodule.title}</span>
        </>
      )}
    </div>
  );
}

function PageHeader({
  module,
  title,
  description,
  onOpenDrawer,
  onConfirm,
}: {
  module: Module;
  title: string;
  description: string;
  onOpenDrawer: () => void;
  onConfirm: () => void;
}) {
  const Icon = module.icon;
  return (
    <section className="page-header">
      <div className={clsx("module-icon", `tone-${module.color}`)}>
        <Icon size={24} />
      </div>
      <div className="page-title-block">
        <p className="eyebrow">Autonomous AI Forex Trading Ecosystem</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="header-actions">
        <ExportButton />
        <ActionButton icon={Eye} label="Open Context" onClick={onOpenDrawer} variant="secondary" />
        <ActionButton icon={ShieldAlert} label="Emergency Review" onClick={onConfirm} variant="danger" />
      </div>
    </section>
  );
}

function MetricCard({ label, value, delta, tone }: { label: string; value: string; delta: string; tone: StatusTone }) {
  return (
    <article className={clsx("metric-card", `metric-${tone}`)}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <StatusBadge tone={tone}>{delta}</StatusBadge>
    </article>
  );
}

function StatusBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: StatusTone }) {
  return <span className={clsx("status-badge", `status-${tone}`)}>{children}</span>;
}

function StatusPill({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="status-pill">
      <Icon size={16} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FilterPanel() {
  return (
    <section className="panel filter-panel">
      <div>
        <h2>Control Filters</h2>
        <p>Shared filters persist across dashboards, records, reports, and audit views.</p>
      </div>
      <div className="filter-controls">
        <button><Filter size={16} /> Symbol: XAUUSD</button>
        <button><SlidersHorizontal size={16} /> Strategy: Hybrid</button>
        <button><CircleDollarSign size={16} /> Account: Prop</button>
        <button><History size={16} /> Today</button>
      </div>
    </section>
  );
}

function Tabs({ tabs, activeTab, onChange }: { tabs: string[]; activeTab: string; onChange: (tab: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button key={tab} className={clsx(activeTab === tab && "active")} onClick={() => onChange(tab)}>
          {tab}
        </button>
      ))}
    </div>
  );
}

function OperationsPanel({ module }: { module: Module }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>{module.title} Workspace</h2>
          <p>Operational actions, linked workflows, and module-specific requirements.</p>
        </div>
        <ActionButton icon={Zap} label="Run Workflow" variant="primary" />
      </div>
      <div className="feature-grid">
        {module.requiredFeatures.map((feature, index) => (
          <SummaryCard key={feature} feature={feature} index={index} />
        ))}
      </div>
      <div className="workflow-rail">
        {workflowLinks.map((item, index) => (
          <Link key={item.href} href={item.href}>
            <span>{index + 1}</span>
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

function SummaryCard({ feature, index }: { feature: string; index: number }) {
  const tones = ["blue", "green", "amber", "violet", "cyan", "rose"];
  return (
    <article className={clsx("summary-card", `accent-${tones[index % tones.length]}`)}>
      <CheckCircle2 size={18} />
      <strong>{feature}</strong>
      <span>Connected to shared records, reports, alerts, and auditId traceability.</span>
    </article>
  );
}

function DataTable({ records }: { records: LinkedRecord[] }) {
  return (
    <section className="panel data-panel">
      <div className="section-heading">
        <div>
          <h2>Linked Records</h2>
          <p>Every record keeps deep links across AI decisions, trades, risk, reports, and audit trails.</p>
        </div>
        <ExportButton />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Record ID</th>
              <th>Symbol / Account</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Risk</th>
              <th>Drill-down</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>{record.id}</td>
                <td>{record.symbol}</td>
                <td><StatusBadge tone={record.status.includes("Risk") ? "danger" : "success"}>{record.status}</StatusBadge></td>
                <td>{record.owner}</td>
                <td>{record.risk}</td>
                <td>
                  <Link className="table-link" href={record.link}>
                    Open <ExternalLink size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ChartPanel({ module }: { module: Module }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Performance Signal</h2>
          <p>Prepared for SignalR-fed charts and OpenTelemetry-backed operational metrics.</p>
        </div>
        <StatusBadge tone="success">Live-ready</StatusBadge>
      </div>
      <div className="chart-panel" aria-label={`${module.title} chart panel`}>
        {[68, 74, 59, 86, 78, 92, 81, 95, 88, 97, 91, 99].map((height, index) => (
          <span key={index} style={{ height: `${height}%` }} />
        ))}
      </div>
    </section>
  );
}

function Timeline() {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Activity & Audit Timeline</h2>
          <p>Trace userId, sessionId, auditId, decisionId, tradeId, alertId, and reportId changes.</p>
        </div>
      </div>
      <div className="timeline">
        {timeline.map((item) => (
          <article key={item.title}>
            <span>{item.time}</span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function LinkedRecordPanel({ modules: linkedModules, fallback }: { modules: Module[]; fallback: Module }) {
  const links = linkedModules.length ? linkedModules : modules.filter((module) => module.path !== fallback.path).slice(0, 6);
  return (
    <section className="panel linked-panel">
      <h2>Related Modules</h2>
      <p>Contextual navigation prevents dead-end workflows.</p>
      <div>
        {links.map((module) => (
          <Link key={module.path} href={module.path}>
            <module.icon size={17} />
            <span>{module.title}</span>
            <ChevronRight size={15} />
          </Link>
        ))}
      </div>
    </section>
  );
}

function QuickActions({ module, onOpenDrawer, onConfirm }: { module: Module; onOpenDrawer: () => void; onConfirm: () => void }) {
  return (
    <section className="panel quick-actions">
      <h2>Related Actions</h2>
      <ActionButton icon={Play} label={`Start ${module.title}`} variant="primary" />
      <ActionButton icon={Pause} label="Pause Trading" variant="secondary" />
      <ActionButton icon={BookOpen} label="Send to Learning" variant="secondary" onClick={onOpenDrawer} />
      <ActionButton icon={Power} label="Emergency Shutdown" variant="danger" onClick={onConfirm} />
    </section>
  );
}

function StatePanels() {
  return (
    <section className="state-stack">
      <EmptyState />
      <LoadingState />
      <ErrorState />
    </section>
  );
}

function EmptyState() {
  return (
    <div className="state-card">
      <LifeBuoy size={18} />
      <strong>Empty state</strong>
      <span>No filtered records for this symbol set.</span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="state-card">
      <MoreHorizontal size={18} />
      <strong>Loading state</strong>
      <span>Streaming updates from SignalR hub.</span>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="state-card error-state">
      <AlertCircle size={18} />
      <strong>Error state</strong>
      <span>Bridge failures link to monitoring and alerts.</span>
    </div>
  );
}

function AlertCard() {
  return (
    <article className="alert-card">
      <AlertCircle size={18} />
      <div>
        <strong>News risk warning</strong>
        <p>alertId ALT-3317 links to source record and escalation rule.</p>
      </div>
    </article>
  );
}

function DetailDrawer({ open, onClose, module, title }: { open: boolean; onClose: () => void; module: Module; title: string }) {
  return (
    <div className={clsx("drawer-layer", open && "open")} aria-hidden={!open}>
      <button className="drawer-backdrop" onClick={onClose} aria-label="Close drawer" />
      <aside className="detail-drawer">
        <div className="drawer-header">
          <div>
            <p className="eyebrow">Contextual Drawer</p>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close context drawer"><X size={18} /></button>
        </div>
        <AlertCard />
        <TradeCard />
        <RiskCard />
        <StrategyCard />
        <AccountCard />
        <Timeline />
        <p className="drawer-note">
          Integration contract: Next.js calls ASP.NET Core (.NET 9) APIs, consumes SignalR updates, and routes MT5 commands through the C# bridge WebSocket with shared identifiers.
        </p>
      </aside>
    </div>
  );
}

function TradeCard() {
  return (
    <article className="record-card">
      <strong>TradeCard</strong>
      <span>tradeId TRD-1048 - XAUUSD protected, profit lock enabled.</span>
      <Link href="/trade-management/open-trades">View trade</Link>
    </article>
  );
}

function RiskCard() {
  return (
    <article className="record-card">
      <strong>RiskCard</strong>
      <span>Daily drawdown 1.4% of 5.0%; prop firm compliant.</span>
      <Link href="/risk-management/dashboard">View risk logs</Link>
    </article>
  );
}

function StrategyCard() {
  return (
    <article className="record-card">
      <strong>StrategyCard</strong>
      <span>Hybrid XAUUSD priority strategy confidence 86%.</span>
      <Link href="/strategy-management/xauusd-priority">View strategy</Link>
    </article>
  );
}

function AccountCard() {
  return (
    <article className="record-card">
      <strong>AccountCard</strong>
      <span>accountId ACC-2201 connected through Broker-Prime / MT5-02.</span>
      <Link href="/accounts-brokers/trading-accounts">View account</Link>
    </article>
  );
}

function ConfirmModal({ open, onClose, module }: { open: boolean; onClose: () => void; module: Module }) {
  if (!open) return null;

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="confirm-modal">
        <div className="modal-icon"><Lock size={22} /></div>
        <h2 id="confirm-title">Confirm protected action</h2>
        <p>
          This action will create an auditId, notify Risk Management, and link {module.title} to Alerts, Reports, and Emergency Shutdown workflows.
        </p>
        <div className="modal-actions">
          <button className="button button-secondary" onClick={onClose}>Cancel</button>
          <button className="button button-danger" onClick={onClose}>Confirm action</button>
        </div>
      </div>
    </div>
  );
}

function ExportButton() {
  return (
    <button className="button button-secondary">
      <Download size={16} />
      Export
    </button>
  );
}

function ActionButton({
  icon: Icon,
  label,
  variant = "secondary",
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  variant?: "primary" | "secondary" | "danger";
  onClick?: () => void;
}) {
  return (
    <button className={clsx("button", `button-${variant}`)} onClick={onClick}>
      <Icon size={16} />
      {label}
    </button>
  );
}
