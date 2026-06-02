export function ProviderComparisonCenter({ comparison }: { comparison: Array<Record<string, unknown>> }) {
  return (
    <section className="mdoc-panel">
      <div className="mdoc-panel-head"><h2>Provider Comparison Center</h2><b>BEST PROVIDER SELECTION</b></div>
      <div className="mdoc-table-wrap">
        <table>
          <thead><tr><th>Provider</th><th>Latency</th><th>Spread</th><th>Coverage</th><th>Quality</th><th>Availability</th></tr></thead>
          <tbody>
            {comparison.map((row) => (
              <tr key={String(row.provider)}><td>{String(row.provider)}</td><td>{row.latencyMs != null ? `${row.latencyMs} ms` : "—"}</td><td>{String(row.spread)}</td><td>{String(row.coverage)}%</td><td>{String(row.quality)}</td><td>{String(row.availability)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
