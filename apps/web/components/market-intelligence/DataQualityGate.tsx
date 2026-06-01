const checks = ["Market data feed", "Economic calendar", "Broker feed", "Portfolio ledger", "Prop firm rules"];

export function DataQualityGate() {
  return <section className="space-y-4">
    <header><p className="text-xs font-bold text-blue-700">03 MARKET INTELLIGENCE CENTER</p><h1 className="text-2xl font-bold">Data Quality Gate</h1><p>Validate source readiness, freshness and blockers before CACSMS Engine proceeds to Stage 1.</p></header>
    <div className="grid gap-3 md:grid-cols-4">{["Gate Status: PASSED", "Workflow Permission: ALLOWED", "Quality Score: 98%", "Required Sources: 7 / 7"].map((metric) => <article className="rounded-xl border bg-white p-4 font-semibold" key={metric}>{metric}</article>)}</div>
    <article className="rounded-xl border bg-white p-4"><h2 className="font-bold">Validation Rule Matrix</h2><div className="mt-3 grid gap-2">{checks.map((check) => <div className="flex justify-between border-t pt-2" key={check}><span>{check}</span><strong className="text-green-700">PASSED</strong></div>)}</div></article>
  </section>;
}
