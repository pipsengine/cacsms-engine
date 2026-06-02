"use client";

import type { MarketDataProvider } from "../../lib/market-data/types";

type Props = {
  providers: MarketDataProvider[];
  busy?: boolean;
  onConfigure: (provider: MarketDataProvider) => void;
  onEdit: (provider: MarketDataProvider) => void;
  onTest: (id: string) => void;
  onSync: (id: string) => void;
  onEnable: (id: string) => void;
  onDisable: (id: string) => void;
  onDetails: (provider: MarketDataProvider) => void;
  onLogs: (provider: MarketDataProvider) => void;
  onDelete: (provider: MarketDataProvider) => void;
};

export function ProviderRegistry({
  providers, busy, onConfigure, onEdit, onTest, onSync, onEnable, onDisable, onDetails, onLogs, onDelete
}: Props) {
  return (
    <section className="mdoc-panel">
      <div className="mdoc-panel-head"><h2>Provider Registry</h2><b>{providers.length} PROVIDERS</b></div>
      <div className="mdoc-table-wrap">
        <table>
          <thead><tr><th>Provider</th><th>Type</th><th>Status</th><th>Health</th><th>Freshness</th><th>Latency</th><th>Coverage</th><th>Last Sync</th><th>Actions</th></tr></thead>
          <tbody>
            {providers.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td><td>{row.type}</td><td><b className={`mdoc-state ${row.status.toLowerCase()}`}>{row.status}</b></td>
                <td>{row.health}</td><td>{row.freshness || "—"}</td><td>{row.latencyMs != null ? `${row.latencyMs} ms` : "—"}</td>
                <td>{row.coverage}</td><td>{row.lastSync ? new Date(String(row.lastSync)).toLocaleString() : "—"}</td>
                <td className="mdoc-actions">
                  <button disabled={busy} onClick={() => onConfigure(row)}>Configure</button>
                  <button disabled={busy} onClick={() => onEdit(row)}>Edit</button>
                  <button disabled={busy} onClick={() => onTest(row.id)}>Test</button>
                  <button disabled={busy} onClick={() => onSync(row.id)}>Sync Symbols</button>
                  <button disabled={busy} onClick={() => (row.enabled ? onDisable(row.id) : onEnable(row.id))}>{row.enabled ? "Disable" : "Enable"}</button>
                  <button disabled={busy} onClick={() => onDetails(row)}>View Details</button>
                  <button disabled={busy} onClick={() => onLogs(row)}>View Logs</button>
                  <button disabled={busy} onClick={() => onDelete(row)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
