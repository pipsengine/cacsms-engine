"use client";

type Props = {
  open: boolean;
  logs: Array<Record<string, unknown>>;
  onClose: () => void;
};

export function LogsDrawer({ open, logs, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="mdoc-drawer-backdrop" onClick={onClose}>
      <aside className="mdoc-drawer wide" onClick={(event) => event.stopPropagation()}>
        <div className="mdoc-panel-head"><h2>Market Data Logs</h2><button className="mdoc-button secondary" onClick={onClose}>Close</button></div>
        <div className="mdoc-table-wrap"><table><thead><tr><th>Time</th><th>Provider</th><th>Event</th><th>Severity</th><th>Message</th></tr></thead><tbody>
          {logs.map((row) => (
            <tr key={String(row.id)}>
              <td>{row.timestamp ? new Date(String(row.timestamp)).toLocaleString() : String(row.time || "—")}</td>
              <td>{String(row.provider || "system")}</td>
              <td>{String(row.event)}</td>
              <td>{String(row.severity)}</td>
              <td>{String(row.message)}</td>
            </tr>
          ))}
        </tbody></table></div>
      </aside>
    </div>
  );
}
