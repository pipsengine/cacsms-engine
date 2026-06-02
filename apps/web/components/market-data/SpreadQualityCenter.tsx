export function SpreadQualityCenter({ spreadQuality }: { spreadQuality: Array<Record<string, unknown>> }) {
  return (
    <section className="mdoc-panel">
      <div className="mdoc-panel-head"><h2>Spread Quality Center</h2><b>EXECUTION IMPACT</b></div>
      <div className="mdoc-table-wrap">
        <table>
          <thead><tr><th>Symbol</th><th>Current Spread</th><th>Average Spread</th><th>Quality</th><th>Risk Impact</th></tr></thead>
          <tbody>
            {spreadQuality.map((row) => (
              <tr key={String(row.symbol)}><td>{String(row.symbol)}</td><td>{String(row.currentSpread)}</td><td>{String(row.averageSpread)}</td><td>{String(row.quality)}</td><td>{String(row.riskImpact)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
