export function LatencyMonitor({ latency }: { latency: Record<string, unknown> }) {
  const trend = (latency.trend as number[]) || [];
  return (
    <section className="mdoc-panel">
      <div className="mdoc-panel-head"><h2>Latency Monitor</h2><b>{latency.averageLatencyMs != null ? `${latency.averageLatencyMs}ms AVG` : "NO PROBE"}</b></div>
      <div className="mdoc-metrics">
        <span>Average Latency<strong>{latency.averageLatencyMs != null ? `${latency.averageLatencyMs} ms` : "—"}</strong></span>
        <span>Max Latency<strong>{String(latency.maxLatencyMs || 0)} ms</strong></span>
        <span>Connection Stability<strong>{String(latency.connectionStability)}</strong></span>
      </div>
      <div className="mdoc-bars">{trend.map((height, index) => <i key={index} style={{ height: `${Math.max(height, 4)}%` }} />)}</div>
    </section>
  );
}
