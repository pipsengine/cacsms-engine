export function TickQualityMonitor({ tickQuality }: { tickQuality: Record<string, unknown> }) {
  const bars = (tickQuality.ticksPerMinute as number[]) || [];
  return (
    <section className="mdoc-panel">
      <div className="mdoc-panel-head"><h2>Tick Quality Monitor</h2><b>{String(tickQuality.tickStability)}</b></div>
      <div className="mdoc-metrics">
        <span>Tick Frequency<strong>{String(tickQuality.tickFrequency)}</strong></span>
        <span>Tick Gaps<strong>{String(tickQuality.tickGaps)}</strong></span>
        <span>Missing Ticks<strong>{String(tickQuality.missingTicks)}</strong></span>
        <span>Tick Stability<strong>{String(tickQuality.tickStability)}</strong></span>
      </div>
      <div className="mdoc-bars">{bars.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
    </section>
  );
}
