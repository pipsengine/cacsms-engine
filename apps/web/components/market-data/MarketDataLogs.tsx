export function MarketDataLogs({ logs }: { logs: Array<Record<string, unknown>> }) {
  return (
    <section className="mdoc-panel" id="mdoc-logs">
      <div className="mdoc-panel-head"><h2>Market Data Logs</h2><b>{logs.length} EVENTS</b></div>
      <div className="mdoc-table-wrap">
        <table>
          <thead><tr><th>Timestamp</th><th>Provider</th><th>Event</th><th>Severity</th><th>Message</th></tr></thead>
          <tbody>
            {logs.map((log) => (
              <tr key={String(log.id)}><td>{new Date(String(log.timestamp)).toLocaleString()}</td><td>{String(log.provider)}</td><td>{String(log.event)}</td><td>{String(log.severity).toUpperCase()}</td><td>{String(log.message)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
