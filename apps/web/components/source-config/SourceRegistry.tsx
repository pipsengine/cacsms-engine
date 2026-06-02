import type { SourceConfigurationDashboard } from "../../lib/source-config/types";

type Props = {
  registry: SourceConfigurationDashboard["registry"];
  onConfigure: (id: string) => void;
  onTest: (id: string) => void;
  onSync: (id: string) => void;
  onDisable: (id: string) => void;
  busy?: boolean;
};

export function SourceRegistry({ registry, onConfigure, onTest, onSync, onDisable, busy }: Props) {
  return (
    <section className="sc-panel">
      <div className="sc-panel-head"><h2>Source Registry</h2><b>{registry.length} SOURCES</b></div>
      <div className="sc-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Source</th><th>Provider</th><th>Provider Type</th><th>Status</th><th>Health</th>
              <th>Last Sync</th><th>Latency</th><th>Records</th><th>Authentication</th><th>Environment</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {registry.map((row) => (
              <tr key={row.id}>
                <td>{row.source}</td>
                <td>{row.provider}</td>
                <td>{row.providerType}</td>
                <td><b className={`sc-state ${row.status.toLowerCase()}`}>{row.status}</b></td>
                <td>{row.health}</td>
                <td>{row.lastSync ? new Date(row.lastSync).toLocaleString() : "—"}</td>
                <td>{row.latencyMs != null ? `${row.latencyMs} ms` : "—"}</td>
                <td>{row.records.toLocaleString()}</td>
                <td>{row.authentication}</td>
                <td>{row.environment}</td>
                <td className="sc-actions">
                  <button disabled={busy} onClick={() => onConfigure(row.id)}>Configure</button>
                  <button disabled={busy} onClick={() => onTest(row.id)}>Test</button>
                  <button disabled={busy} onClick={() => onDisable(row.id)}>{row.enabled ? "Disable" : "Enable"}</button>
                  <button disabled={busy} onClick={() => onSync(row.id)}>Sync</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
