export function KpiCards({ kpis }: { kpis: [string, string | number][] }) {
  return (
    <section className="mdoc-kpi-grid">
      {kpis.map(([label, value]) => (
        <article key={label} className="mdoc-kpi"><small>{label}</small><strong>{value}</strong></article>
      ))}
    </section>
  );
}
