"use client";

import type { MarketDataProvider } from "../../lib/market-data/types";

type Props = {
  open: boolean;
  provider: MarketDataProvider | null;
  coverage: Array<Record<string, unknown>>;
  logs: Array<Record<string, unknown>>;
  onClose: () => void;
};

export function ProviderDetailsDrawer({ open, provider, coverage, logs, onClose }: Props) {
  if (!open || !provider) return null;
  return (
    <div className="mdoc-drawer-backdrop" onClick={onClose}>
      <aside className="mdoc-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="mdoc-panel-head"><h2>{provider.name}</h2><button className="mdoc-button secondary" onClick={onClose}>Close</button></div>
        <div className="mdoc-metrics">
          <span>Status<strong>{provider.status}</strong></span>
          <span>Health<strong>{provider.health}%</strong></span>
          <span>Latency<strong>{provider.latencyMs != null ? `${provider.latencyMs} ms` : "Not Available"}</strong></span>
          <span>Coverage<strong>{provider.coverage}</strong></span>
          <span>Connection<strong>{provider.connectionMethod || "—"}</strong></span>
          <span>Environment<strong>{provider.environment}</strong></span>
          <span>Auth<strong>{provider.authType}</strong></span>
          <span>Vault Ref<strong>{provider.vaultSecretRef || "—"}</strong></span>
        </div>
        <section className="mdoc-panel">
          <div className="mdoc-panel-head"><h3>Configuration</h3></div>
          <p><strong>Base URL:</strong> {provider.baseUrl || "—"}</p>
          <p><strong>WebSocket URL:</strong> {provider.websocketUrl || "—"}</p>
          <p><strong>Notes:</strong> {provider.notes || "—"}</p>
          <p><strong>Workflow impact:</strong> {provider.workflowImpact || "Operational dependency"}</p>
        </section>
        <section className="mdoc-panel">
          <div className="mdoc-panel-head"><h3>Coverage</h3><b>{coverage.length} rows</b></div>
          <div className="mdoc-table-wrap"><table><thead><tr><th>Symbol</th><th>Price</th><th>Status</th></tr></thead><tbody>
            {coverage.slice(0, 12).map((row) => (
              <tr key={String(row.symbol)}><td>{String(row.symbol)}</td><td>{row.price_feed ? "Yes" : "No"}</td><td>{String(row.status)}</td></tr>
            ))}
          </tbody></table></div>
        </section>
        <section className="mdoc-panel">
          <div className="mdoc-panel-head"><h3>Latest Logs</h3></div>
          <div className="mdoc-table-wrap"><table><thead><tr><th>Event</th><th>Message</th></tr></thead><tbody>
            {logs.slice(0, 8).map((row) => (
              <tr key={String(row.id)}><td>{String(row.event)}</td><td>{String(row.message)}</td></tr>
            ))}
          </tbody></table></div>
        </section>
      </aside>
    </div>
  );
}
