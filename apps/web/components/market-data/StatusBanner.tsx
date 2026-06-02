export function StatusBanner({ banner }: { banner: Record<string, string> }) {
  const items = [
    ["Workflow Status", banner.workflowStatus],
    ["Market Data Health", banner.marketDataHealth],
    ["Live Symbols", banner.liveSymbols],
    ["Average Latency", banner.averageLatency],
    ["Feed Freshness", banner.feedFreshness],
    ["Data Confidence Score", banner.dataConfidenceScore]
  ];
  return (
    <section className="mdoc-banner">
      {items.map(([label, value]) => (
        <article key={label} className={label === "Workflow Status" && value === "BLOCKED" ? "danger" : label === "Workflow Status" && value === "RESTRICTED" ? "warning" : ""}>
          <small>{label}</small><strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}
