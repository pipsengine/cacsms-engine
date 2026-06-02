import type { SourceConfigurationDashboard } from "../../lib/source-config/types";

export function AuditLogsPanel({ logs }: { logs: SourceConfigurationDashboard["auditLogs"] }) {
  return (
    <section className="sc-panel">
      <div className="sc-panel-head"><h2>Audit & Activity Logs</h2><b>{logs.length} EVENTS</b></div>
      <div className="sc-table-wrap">
        <table>
          <thead><tr><th>Timestamp</th><th>Source</th><th>Event</th><th>Severity</th><th>User</th><th>Result</th></tr></thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.timestamp).toLocaleString()}</td>
                <td>{log.sourceKey}</td>
                <td>{log.event}</td>
                <td>{log.severity.toUpperCase()}</td>
                <td>{log.user}</td>
                <td>{log.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
