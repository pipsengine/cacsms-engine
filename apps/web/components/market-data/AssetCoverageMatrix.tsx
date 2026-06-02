export function AssetCoverageMatrix({ coverage }: { coverage: Array<Record<string, unknown>> }) {
  return (
    <section className="mdoc-panel">
      <div className="mdoc-panel-head"><h2>Asset Coverage Matrix</h2><b>20 ASSETS</b></div>
      <div className="mdoc-table-wrap">
        <table>
          <thead><tr><th>Symbol</th><th>Price Feed</th><th>Tick Feed</th><th>Spread Feed</th><th>Volume Feed</th><th>Provider</th><th>Coverage</th><th>Status</th></tr></thead>
          <tbody>
            {coverage.map((row) => (
              <tr key={String(row.symbol)}>
                <td>{String(row.symbol)}</td><td>{row.priceFeed ? "Available" : "Unavailable"}</td><td>{row.tickFeed ? "Available" : "Unavailable"}</td>
                <td>{row.spreadFeed ? "Available" : "Unavailable"}</td><td>{row.volumeFeed ? "Available" : "Unavailable"}</td>
                <td>{String(row.provider)}</td><td>{String(row.coverage)}%</td><td>{String(row.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
