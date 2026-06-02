"use client";

import type { SourceConfigurationDashboard } from "../../lib/source-config/types";

type Props = {
  data: SourceConfigurationDashboard["header"];
  onAddProvider: () => void;
  onTestAll: () => void;
  onSyncAll: () => void;
  onExport: () => void;
  busy?: boolean;
};

export function Header({ data, onAddProvider, onTestAll, onSyncAll, onExport, busy }: Props) {
  const badges = [
    ["Connected Sources", data.connectedSources],
    ["Healthy Sources", data.healthySources],
    ["Failed Sources", data.failedSources],
    ["Last Validation", new Date(data.lastValidation).toLocaleString()],
    ["Environment", data.environment.toUpperCase()]
  ];

  return (
    <header className="sc-header">
      <div>
        <p className="eyebrow">MARKET INTELLIGENCE / MASTER CONNECTIVITY</p>
        <h1>Source Configuration Center</h1>
        <p className="subtitle">Centralized management, configuration, testing and monitoring of all market intelligence data providers.</p>
        <div className="sc-badges">
          {badges.map(([label, value]) => (
            <span key={label}><small>{label}</small><strong>{value}</strong></span>
          ))}
        </div>
      </div>
      <div className="sc-header-actions">
        <button className="sc-button secondary" onClick={onAddProvider} disabled={busy}>Add Provider</button>
        <button className="sc-button primary" onClick={onTestAll} disabled={busy}>Test All Connections</button>
        <button className="sc-button secondary" onClick={onSyncAll} disabled={busy}>Sync All Sources</button>
        <button className="sc-button secondary" onClick={onExport} disabled={busy}>Export Configuration</button>
      </div>
    </header>
  );
}
