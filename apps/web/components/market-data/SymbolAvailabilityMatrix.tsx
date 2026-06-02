export function SymbolAvailabilityMatrix({ matrix }: { matrix: Array<Record<string, unknown>> }) {
  const symbols = matrix[0]?.symbols ? Object.keys(matrix[0].symbols as Record<string, string>) : [];
  return (
    <section className="mdoc-panel mdoc-wide">
      <div className="mdoc-panel-head"><h2>Symbol Availability Matrix</h2><b>{matrix.length} PROVIDERS</b></div>
      <div className="mdoc-table-wrap">
        <table>
          <thead><tr><th>Provider</th>{symbols.map((symbol) => <th key={symbol}>{symbol}</th>)}</tr></thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={String(row.provider)}>
                <td>{String(row.provider)}</td>
                {symbols.map((symbol) => {
                  const value = (row.symbols as Record<string, string>)?.[symbol] || "—";
                  return <td key={symbol} className={value === "Available" ? "success" : value === "Unavailable" ? "danger" : "warning"}>{value}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
