"use client";

import { Plus } from "lucide-react";
import type { MarketDataDashboard } from "../../lib/market-data/types";

type Props = {
  header: MarketDataDashboard["header"];
  onAddProvider: () => void;
  onTestProviders: () => void;
  onSyncSymbols: () => void;
  onExport: () => void;
  onRefresh: () => void;
  busy?: boolean;
};

export function Header({ header, onAddProvider, onTestProviders, onSyncSymbols, onExport, onRefresh, busy }: Props) {
  const badges = [
    ["Connected Providers", header.connectedProviders],
    ["Healthy Providers", header.healthyProviders],
    ["Live Symbols", header.liveSymbols],
    ["Workflow Status", header.workflowStatus],
    ["Data Confidence", header.dataConfidence]
  ];
  return (
    <header className="mdoc-header">
      <div>
        <p className="eyebrow">MARKET INTELLIGENCE / MARKET DATA OPERATIONS</p>
        <h1>Market Data Providers</h1>
        <p className="subtitle">Manage, validate and monitor all market data providers powering CACSMS Engine.</p>
        <div className="mdoc-badges">{badges.map(([label, value]) => <span key={label}><small>{label}</small><strong>{value}</strong></span>)}</div>
      </div>
      <div className="mdoc-header-actions">
        <button className="mdoc-button primary mdoc-add-provider-btn" disabled={busy} onClick={onAddProvider}><Plus size={14} /> Add Provider</button>
        <button className="mdoc-button secondary" disabled={busy} onClick={onTestProviders}>Test Providers</button>
        <button className="mdoc-button secondary" disabled={busy} onClick={onSyncSymbols}>Sync Symbols</button>
        <button className="mdoc-button secondary" disabled={busy} onClick={onRefresh}>Refresh</button>
        <button className="mdoc-button secondary" disabled={busy} onClick={onExport}>Export Status</button>
      </div>
    </header>
  );
}
