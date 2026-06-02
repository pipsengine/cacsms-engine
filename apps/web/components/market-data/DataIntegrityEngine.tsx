export function DataIntegrityEngine({ integrity }: { integrity: { score: number; checks: Record<string, number> } }) {
  return (
    <section className="mdoc-panel mdoc-integrity">
      <div className="mdoc-panel-head"><h2>Data Integrity Engine</h2><b>{integrity.score}%</b></div>
      <strong className="mdoc-score">{integrity.score}</strong>
      <div className="mdoc-metrics">
        {Object.entries(integrity.checks).map(([label, value]) => (
          <span key={label}>{label.replace(/([A-Z])/g, " $1").trim()}<strong>{value}</strong></span>
        ))}
      </div>
    </section>
  );
}
